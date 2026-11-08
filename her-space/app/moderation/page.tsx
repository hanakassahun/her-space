"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import { friendlyError } from "@/lib/errors";
import type { TranslationKey } from "@/lib/i18n/en";
import { supabase } from "@/lib/supabase";

type TargetKind = "post" | "comment";
type Resolution = "removed" | "dismissed" | "no_action";
type QueueItem = {
  target_kind: TargetKind;
  post_id: string | null;
  comment_id: string | null;
  report_count: number;
  severity_rank: number;
  categories: string[];
  reasons: string[];
  first_reported_at: string;
};
type QueueSummary = {
  open_total: number;
  open_urgent: number;
  open_high: number;
  handled_today: number;
};
type ModerationContent = {
  id: string;
  title?: string | null;
  body: string;
  is_quick?: boolean;
  type?: string;
  has_poll?: boolean;
  poll_options?: { position: number; label: string }[];
  post_id?: string | null;
  hidden_at?: string | null;
};
type ModTemplate = { id: string; title: string; body: string };
type Reporter = { reporter_id: string; category: string; created_at: string; profiles: { display_name: string | null } | { display_name: string | null }[] | null };

const errorText: Partial<Record<TranslationKey, string>> = {
  "errors.rateLimit": "Please wait a moment before trying again.",
  "errors.network": "Check your connection and try again.",
  "errors.sessionExpired": "Your session expired. Please sign in again.",
  "errors.generic": "Something went wrong. Please try again.",
};
const translateError = (key: TranslationKey) => errorText[key] ?? "Something went wrong. Please try again.";
const breakStorageKey = "her-space:moderation:shown-count";

const categoryLabels: Record<string, string> = {
  self_harm: "Self-harm or immediate safety",
  abuse: "Abuse or threats",
  harassment: "Harassment or shaming",
  sexual_content: "Sexual or explicit content",
  privacy: "Private information",
  misinformation: "Harmful medical claims",
  spam: "Selling or spam",
  other: "Other",
};

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function targetKey(item: QueueItem) {
  return `${item.target_kind}:${item.target_kind === "post" ? item.post_id : item.comment_id}`;
}

function targetId(item: QueueItem) {
  return item.target_kind === "post" ? item.post_id : item.comment_id;
}

function getSeverity(rank: number) {
  if (rank === 0) return { label: "Urgent", className: "bg-rose-100 text-rose-900" };
  if (rank === 1) return { label: "High", className: "bg-soft-lilac text-deep-plum" };
  return { label: "Normal", className: "bg-gray-100 text-gray-700" };
}

function elapsedTime(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function ModerationPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin, isModerator } = useAuth();
  const userId = user?.id ?? null;
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [summary, setSummary] = useState<QueueSummary>({
    open_total: 0,
    open_urgent: 0,
    open_high: 0,
    handled_today: 0,
  });
  const [dailyCap, setDailyCap] = useState(20);
  const [capDraft, setCapDraft] = useState("20");
  const [capOpen, setCapOpen] = useState(false);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [pauseActive, setPauseActive] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [templates, setTemplates] = useState<ModTemplate[]>([]);
  const [shownContent, setShownContent] = useState<Record<string, ModerationContent | null>>({});
  const [contentLoading, setContentLoading] = useState<string[]>([]);
  const [showAllContent, setShowAllContent] = useState<Record<string, boolean>>({});
  const [showReasons, setShowReasons] = useState<Record<string, boolean>>({});
  const [hiddenItems, setHiddenItems] = useState<Record<string, boolean>>({});
  const [privateNotes, setPrivateNotes] = useState<Record<string, string>>({});
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, string>>({});
  const [busyItems, setBusyItems] = useState<string[]>([]);
  const [reporters, setReporters] = useState<Record<string, Reporter[]>>({});
  const [reportersLoading, setReportersLoading] = useState<string[]>([]);
  const [shownCount, setShownCount] = useState(0);
  const [dismissedBreakCount, setDismissedBreakCount] = useState(0);
  const [keepGoing, setKeepGoing] = useState(false);

  const showCapReminder = summary.handled_today >= dailyCap && !keepGoing;
  const breakDue = shownCount > 0 && shownCount % 8 === 0 && dismissedBreakCount !== shownCount;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedCount = Number(window.sessionStorage.getItem(breakStorageKey) ?? "0");
      if (Number.isFinite(storedCount) && storedCount > 0) setShownCount(storedCount);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadSummary = useCallback(async () => {
    const { data, error } = await supabase.rpc("mod_queue_summary");
    if (error) {
      setErrorMessage(friendlyError(error, translateError));
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const next = {
      open_total: Number(row?.open_total ?? 0),
      open_urgent: Number(row?.open_urgent ?? 0),
      open_high: Number(row?.open_high ?? 0),
      handled_today: Number(row?.handled_today ?? 0),
    };
    setSummary(next);
    return next;
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    const { data, error } = await supabase.rpc("mod_queue", { p_limit: 20 });
    if (error) {
      setErrorMessage(friendlyError(error, translateError));
      setQueueLoading(false);
      return;
    }
    setQueue((data ?? []) as QueueItem[]);
    setQueueLoading(false);
  }, []);

  const loadTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from("mod_templates")
      .select("id, title, body")
      .order("title", { ascending: true });
    if (error) {
      setErrorMessage(friendlyError(error, translateError));
      return;
    }
    setTemplates((data ?? []) as ModTemplate[]);
  }, []);

  const refreshQueueAndSummary = useCallback(async () => {
    await Promise.all([loadSummary(), loadQueue()]);
  }, [loadQueue, loadSummary]);

  useEffect(() => {
    if (!pauseActive || !pausedUntil) return;
    const remaining = new Date(pausedUntil).getTime() - Date.now();
    const timer = window.setTimeout(() => {
      setPauseActive(false);
      setPausedUntil(null);
      void Promise.all([loadQueue(), loadTemplates()]);
    }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [loadQueue, loadTemplates, pauseActive, pausedUntil]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }

    let active = true;
    async function authorizeAndLoad() {
      setLoading(true);
      const { data: moderator, error: moderatorError } = await supabase.rpc("is_moderator");
      if (!active) return;
      if (moderatorError) {
        setErrorMessage(friendlyError(moderatorError, translateError));
        setLoading(false);
        return;
      }
      if (!moderator) {
        router.replace("/");
        return;
      }
      setAuthorized(true);

      const [prefsResult] = await Promise.all([
        supabase
          .from("mod_prefs")
          .select("daily_cap, paused_until")
          .eq("user_id", userId)
          .maybeSingle(),
        loadSummary(),
      ]);
      if (!active) return;
      if (prefsResult.error) setErrorMessage(friendlyError(prefsResult.error, translateError));
      const cap = Math.min(100, Math.max(1, Number(prefsResult.data?.daily_cap ?? 20)));
      const pause = prefsResult.data?.paused_until ?? null;
      setDailyCap(cap);
      setCapDraft(String(cap));
      const isPauseActive = Boolean(pause && new Date(pause).getTime() > Date.now());
      setPausedUntil(isPauseActive ? pause : null);
      setPauseActive(isPauseActive);
      if (isPauseActive) {
        setQueue([]);
        setTemplates([]);
      } else {
        await Promise.all([loadQueue(), loadTemplates()]);
      }
      setLoading(false);
    }

    void authorizeAndLoad();
    return () => {
      active = false;
    };
  }, [authLoading, loadQueue, loadSummary, loadTemplates, router, userId]);

  const careTemplate = useMemo(
    () => templates.find((template) => template.title.toLowerCase().startsWith("care message")),
    [templates]
  );

  function getMessageText(item: QueueItem) {
    const key = targetKey(item);
    if (messageDrafts[key] !== undefined) return messageDrafts[key];
    const selectedId = selectedTemplates[key] ?? (
      item.categories.includes("self_harm") ? careTemplate?.id : undefined
    );
    return templates.find((template) => template.id === selectedId)?.body ?? "";
  }

  async function savePause(until: Date | null) {
    setErrorMessage("");
    const { error } = await supabase
      .from("mod_prefs")
      .upsert({ paused_until: until?.toISOString() ?? null }, { onConflict: "user_id" });
    if (error) {
      setErrorMessage(friendlyError(error, translateError));
      return;
    }
    setPausedUntil(until?.toISOString() ?? null);
    setPauseActive(Boolean(until && until.getTime() > Date.now()));
    if (until) {
      setQueue([]);
      setTemplates([]);
    } else {
      await Promise.all([loadQueue(), loadTemplates()]);
    }
  }

  async function saveDailyCap() {
    const cap = Number(capDraft);
    if (!Number.isInteger(cap) || cap < 1 || cap > 100) {
      setErrorMessage("Enter a number from 1 to 100.");
      return;
    }
    const { error } = await supabase
      .from("mod_prefs")
      .upsert({ daily_cap: cap }, { onConflict: "user_id" });
    if (error) {
      setErrorMessage(friendlyError(error, translateError));
      return;
    }
    setDailyCap(cap);
    setCapDraft(String(cap));
    setCapOpen(false);
    setKeepGoing(false);
  }

  async function showContent(item: QueueItem) {
    const key = targetKey(item);
    const id = targetId(item);
    if (!id || shownContent[key] !== undefined || contentLoading.includes(key)) return;
    setContentLoading((current) => [...current, key]);
    setErrorMessage("");
    const result = item.target_kind === "post"
      ? await supabase.from("posts").select("id, title, body, is_quick, type, has_poll, hidden_at").eq("id", id).maybeSingle()
      : await supabase.from("comments").select("id, body, post_id, hidden_at").eq("id", id).maybeSingle();
    if (result.error) {
      setErrorMessage(friendlyError(result.error, translateError));
    } else {
      let pollOptions: { position: number; label: string }[] = [];
      if (item.target_kind === "post" && result.data && "has_poll" in result.data && result.data.has_poll) {
        const { data, error } = await supabase
          .from("poll_options")
          .select("position, label")
          .eq("post_id", id)
          .order("position");
        if (error) setErrorMessage(friendlyError(error, translateError));
        else pollOptions = data ?? [];
      }
      setShownContent((current) => ({
        ...current,
        [key]: result.data ? { ...(result.data as ModerationContent), poll_options: pollOptions } : null,
      }));
      if (result.data) {
        const isHidden = Boolean(result.data.hidden_at);
        setHiddenItems((current) => ({ ...current, [key]: isHidden }));
        setShownCount((count) => {
          const next = count + 1;
          window.sessionStorage.setItem(breakStorageKey, String(next));
          return next;
        });
      }
    }
    setContentLoading((current) => current.filter((value) => value !== key));
  }

  async function resolveItem(item: QueueItem, resolution: Resolution) {
    const key = targetKey(item);
    if (busyItems.includes(key)) return;
    if (resolution === "removed" && !window.confirm("Remove this content? This cannot be undone.")) return;
    const message = getMessageText(item);
    if (message.includes("[") || message.includes("]")) return;
    setBusyItems((current) => [...current, key]);
    setErrorMessage("");
    setQueue((current) => current.filter((entry) => targetKey(entry) !== key));
    const { error } = await supabase.rpc("mod_resolve_target", {
      p_post: item.target_kind === "post" ? item.post_id : null,
      p_comment: item.target_kind === "comment" ? item.comment_id : null,
      p_resolution: resolution,
      p_note: privateNotes[key]?.trim() || null,
      p_message: message.trim() || null,
    });
    if (error) {
      setErrorMessage(friendlyError(error, translateError));
      await refreshQueueAndSummary();
    } else {
      await refreshQueueAndSummary();
    }
    setBusyItems((current) => current.filter((value) => value !== key));
  }

  async function toggleHidden(item: QueueItem) {
    const key = targetKey(item);
    if (busyItems.includes(key)) return;
    const nextHidden = !hiddenItems[key];
    setBusyItems((current) => [...current, key]);
    setErrorMessage("");
    const { error } = await supabase.rpc("mod_set_hidden", {
      p_post: item.target_kind === "post" ? item.post_id : null,
      p_comment: item.target_kind === "comment" ? item.comment_id : null,
      p_hidden: nextHidden,
    });
    if (error) {
      setErrorMessage(friendlyError(error, translateError));
    } else {
      setHiddenItems((current) => ({ ...current, [key]: nextHidden }));
      await refreshQueueAndSummary();
    }
    setBusyItems((current) => current.filter((value) => value !== key));
  }

  async function snoozeItem(item: QueueItem, hours: number) {
    const key = targetKey(item);
    if (busyItems.includes(key)) return;
    setBusyItems((current) => [...current, key]);
    setErrorMessage("");
    setQueue((current) => current.filter((entry) => targetKey(entry) !== key));
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.rpc("mod_snooze_target", {
      p_post: item.target_kind === "post" ? item.post_id : null,
      p_comment: item.target_kind === "comment" ? item.comment_id : null,
      p_until: until,
    });
    if (error) setErrorMessage(friendlyError(error, translateError));
    await refreshQueueAndSummary();
    setBusyItems((current) => current.filter((value) => value !== key));
  }

  async function loadReporters(item: QueueItem) {
    const key = targetKey(item);
    if (!isAdmin || isModerator || reportersLoading.includes(key)) return;
    setReportersLoading((current) => [...current, key]);
    setErrorMessage("");
    let query = supabase
      .from("reports")
      .select("reporter_id, category, created_at, profiles!reports_reporter_id_fkey(display_name)")
      .eq("status", "open");
    query = item.target_kind === "post"
      ? query.eq("post_id", item.post_id)
      : query.eq("comment_id", item.comment_id);
    const { data, error } = await query;
    if (error) setErrorMessage(friendlyError(error, translateError));
    else setReporters((current) => ({ ...current, [key]: (data ?? []) as Reporter[] }));
    setReportersLoading((current) => current.filter((value) => value !== key));
  }

  if (loading || authLoading || (!authorized && !errorMessage)) {
    return (
      <PageShell className="max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <p className="sr-only">Checking moderator access…</p>
      </PageShell>
    );
  }
  if (!authorized) {
    return (
      <PageShell className="max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <Card className="text-red-700" role="alert"><FriendlyErrorMessage message={errorMessage} /></Card>
      </PageShell>
    );
  }

  if (pauseActive) {
    return (
      <PageShell className="max-w-3xl space-y-5 px-4 py-6 md:px-6 md:py-10">
        {errorMessage && <Card className="text-red-700" role="alert"><FriendlyErrorMessage message={errorMessage} /></Card>}
        <Card className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-deep-plum">Your moderation pause is active</h1>
          <p className="text-gray-700">There are {summary.open_total} open items. They can wait until you’re ready.</p>
          <Button type="button" onClick={() => void savePause(null)}>Resume</Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-4xl space-y-5 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-deep-plum">Moderation</h1>
            <p className="mt-1 text-sm text-gray-600">A steady pace is part of keeping this space safe.</p>
          </div>
          <details className="relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-full border border-[#CDBDEB] bg-white px-4 text-sm font-semibold text-deep-plum">Pause</summary>
            <div className="absolute right-0 z-10 mt-2 w-56 space-y-1 rounded-2xl border border-white/70 bg-pearl-white p-2 shadow-xl">
              <button className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-soft-lilac/40" type="button" onClick={() => void savePause(new Date(Date.now() + 60 * 60 * 1000))}>Pause for 1 hour</button>
              <button className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-soft-lilac/40" type="button" onClick={() => void savePause(new Date(Date.now() + 4 * 60 * 60 * 1000))}>Pause for 4 hours</button>
              <button className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-soft-lilac/40" type="button" onClick={() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0); void savePause(tomorrow); }}>Until tomorrow morning</button>
              <button className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-soft-lilac/40" type="button" onClick={() => void savePause(null)}>Resume</button>
            </div>
          </details>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-rose-100 text-rose-900">{summary.open_urgent} urgent</Badge>
          <Badge>{summary.open_high} high</Badge>
          <Badge className="bg-gray-100 text-gray-700">{summary.open_total} open</Badge>
          <span className="text-sm text-gray-700">
            Handled today: {summary.handled_today} of {dailyCap}
          </span>
          <div className="relative">
            <Button className="min-h-11 px-3 text-xs" variant="ghost" type="button" onClick={() => { setCapDraft(String(dailyCap)); setCapOpen((open) => !open); }}>
              Edit cap
            </Button>
            {capOpen && (
              <div className="absolute left-0 z-10 mt-2 w-64 space-y-3 rounded-2xl border border-white/70 bg-pearl-white p-4 shadow-xl">
                <label className="block space-y-1 text-sm font-medium text-deep-plum">
                  Daily cap (1–100)
                  <Input type="number" min={1} max={100} value={capDraft} onChange={(event) => setCapDraft(event.target.value)} />
                </label>
                <div className="flex gap-2">
                  <Button className="min-h-11 px-4" type="button" onClick={() => void saveDailyCap()}>Save</Button>
                  <Button className="min-h-11 px-4" variant="ghost" type="button" onClick={() => setCapOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {errorMessage && <Card className="whitespace-pre-line text-red-700" role="alert"><FriendlyErrorMessage message={errorMessage} /></Card>}

      {showCapReminder && (
        <Card className="space-y-3 border border-soft-lilac/70">
          <p className="text-gray-700">You’ve done enough for today. The queue will be here tomorrow.</p>
          <Button className="min-h-11 px-3 text-xs" variant="ghost" type="button" onClick={() => setKeepGoing(true)}>Keep going anyway</Button>
        </Card>
      )}

      {breakDue && (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-soft-lilac/30">
          <p className="text-sm text-gray-700">You’ve looked at {shownCount} sensitive items. Consider a 5 minute break.</p>
          <Button className="min-h-11 px-3 text-xs" variant="ghost" type="button" onClick={() => setDismissedBreakCount(shownCount)}>Remind me later</Button>
        </Card>
      )}

      {queueLoading && <p className="text-sm text-gray-600">Loading queue…</p>}
      {!queueLoading && queue.length === 0 && (
        <Card className="text-center text-gray-700">The queue is clear for now.</Card>
      )}

      <section className="space-y-4" aria-label="Moderation queue">
        {queue.map((item) => {
          const key = targetKey(item);
          const severity = getSeverity(item.severity_rank);
          const contentLoaded = shownContent[key] !== undefined;
          const content = shownContent[key];
          const message = getMessageText(item);
          const hasBrackets = message.includes("[") || message.includes("]");
          const busy = busyItems.includes(key);
          const isAdminReporterView = isAdmin && !isModerator;
          const reporterRows = reporters[key];
          const body = content?.body ?? "";
          const skimmed = body.length > 200 && !showAllContent[key] ? `${body.slice(0, 200)}…` : body;

          return (
            <Card as="article" key={key} className="space-y-4">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={severity.className}>{severity.label}</Badge>
                  <span className="text-sm text-gray-600">{item.report_count} report{item.report_count === 1 ? "" : "s"}</span>
                </div>
                <time className="text-xs text-gray-500" dateTime={item.first_reported_at}>{elapsedTime(item.first_reported_at)}</time>
              </header>

              <div className="flex flex-wrap gap-2">
                {item.categories.map((category) => (
                  <Badge key={category}>{categoryLabels[category] ?? category.replaceAll("_", " ")}</Badge>
                ))}
              </div>

              {!contentLoaded ? (
                <Button variant="secondary" type="button" disabled={contentLoading.includes(key)} onClick={() => void showContent(item)}>
                  {contentLoading.includes(key) ? "Loading content…" : "Show content"}
                </Button>
              ) : content === null ? (
                <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">Already removed</p>
              ) : (
                <div className="space-y-2 rounded-2xl bg-gray-50 p-4">
                  {item.target_kind === "post" && content.title && !content.is_quick && <h2 className="font-semibold text-deep-plum">{content.title}</h2>}
                  <p className="whitespace-pre-wrap break-words text-gray-800">{skimmed}</p>
                  {content.poll_options && content.poll_options.length > 0 && (
                    <ul className="list-inside list-disc space-y-1 break-words text-sm text-gray-700" aria-label="Poll options">
                      {content.poll_options.map((option) => <li key={option.position}>{option.label}</li>)}
                    </ul>
                  )}
                  {body.length > 200 && (
                    <div className="flex gap-2">
                      <Button className="min-h-11 px-3 text-xs" variant={!showAllContent[key] ? "secondary" : "ghost"} type="button" onClick={() => setShowAllContent((current) => ({ ...current, [key]: false }))}>Skim</Button>
                      <Button className="min-h-11 px-3 text-xs" variant={showAllContent[key] ? "secondary" : "ghost"} type="button" onClick={() => setShowAllContent((current) => ({ ...current, [key]: true }))}>Show all</Button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Button className="min-h-11 px-3 text-xs" variant="ghost" type="button" onClick={() => setShowReasons((current) => ({ ...current, [key]: !current[key] }))}>
                  {showReasons[key] ? "Hide reporter notes" : "Show reporter notes"}
                </Button>
                {showReasons[key] && (
                  <div className="space-y-2 rounded-xl bg-soft-lilac/25 p-3">
                    {(item.reasons ?? []).map((reason, index) => (
                      <p className="whitespace-pre-wrap break-words text-sm text-gray-700" key={`${index}-${reason}`}>{reason}</p>
                    ))}
                    {item.reasons?.length === 0 && <p className="text-sm text-gray-600">No reporter notes.</p>}
                  </div>
                )}
              </div>

              {isAdminReporterView && (
                <div className="space-y-2">
                  <Button className="min-h-11 px-3 text-xs" variant="ghost" type="button" disabled={reportersLoading.includes(key)} onClick={() => void loadReporters(item)}>
                    {reportersLoading.includes(key) ? "Loading reporters…" : reporterRows ? "Refresh reporters" : "Show reporters"}
                  </Button>
                  {reporterRows && (
                    <div className="space-y-1 rounded-xl bg-gray-50 p-3">
                      {reporterRows.map((reporter, index) => (
                        <p className="break-words text-sm text-gray-700" key={`${reporter.reporter_id}-${index}`}>
                          {first(reporter.profiles)?.display_name || "Her Space member"} · {categoryLabels[reporter.category] ?? reporter.category}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 border-t border-soft-lilac/60 pt-4">
                <label className="block space-y-1 text-sm font-medium text-deep-plum">
                  Private note (optional)
                  <Textarea className="min-h-20" maxLength={500} value={privateNotes[key] ?? ""} onChange={(event) => setPrivateNotes((current) => ({ ...current, [key]: event.target.value }))} />
                </label>

                <details className="space-y-2">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-deep-plum">Message the author (optional)</summary>
                  <div className="space-y-2">
                    <label className="block space-y-1 text-sm font-medium text-deep-plum">
                      Choose a template
                      <select
                        className="min-h-11 w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-2 text-deep-plum"
                        value={selectedTemplates[key] ?? (item.categories.includes("self_harm") ? careTemplate?.id ?? "" : "")}
                        onChange={(event) => {
                          const templateId = event.target.value;
                          setSelectedTemplates((current) => ({ ...current, [key]: templateId }));
                          setMessageDrafts((current) => ({ ...current, [key]: templates.find((template) => template.id === templateId)?.body ?? "" }));
                        }}
                      >
                        <option value="">No template</option>
                        {templates.map((template) => <option value={template.id} key={template.id}>{template.title}</option>)}
                      </select>
                    </label>
                    <label className="block space-y-1 text-sm font-medium text-deep-plum">
                      Message (never sent automatically)
                      <Textarea className="min-h-24" maxLength={1000} value={message} onChange={(event) => setMessageDrafts((current) => ({ ...current, [key]: event.target.value }))} />
                    </label>
                    {hasBrackets && <p className="text-sm text-rose-800">Fill in the [bracketed] parts first.</p>}
                  </div>
                </details>

                <div className="flex flex-wrap gap-2">
                  <Button className="text-sm" type="button" disabled={busy || hasBrackets} onClick={() => void resolveItem(item, "removed")}>Remove</Button>
                  <Button className="text-sm" variant="secondary" type="button" disabled={busy || hasBrackets} onClick={() => void resolveItem(item, "dismissed")}>Keep</Button>
                  <Button className="text-sm" variant="ghost" type="button" disabled={busy || hasBrackets} onClick={() => void resolveItem(item, "no_action")}>Resolve without action</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="min-h-11 px-4 text-sm" variant="secondary" type="button" disabled={busy} onClick={() => void toggleHidden(item)}>
                    {hiddenItems[key] ? "Restore" : "Hide for now"}
                  </Button>
                  <span className="text-xs text-gray-600">Snooze:</span>
                  <Button className="min-h-11 px-3 text-xs" variant="ghost" type="button" disabled={busy} onClick={() => void snoozeItem(item, 1)}>1 hour</Button>
                  <Button className="min-h-11 px-3 text-xs" variant="ghost" type="button" disabled={busy} onClick={() => void snoozeItem(item, 24)}>1 day</Button>
                  <Button className="min-h-11 px-3 text-xs" variant="ghost" type="button" disabled={busy} onClick={() => void snoozeItem(item, 72)}>3 days</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </section>
    </PageShell>
  );
}
