"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { loadPollResults, type PollResult } from "@/lib/polls";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Burst from "@/components/Burst";
import { showJoyLine } from "@/lib/joy";

export default function PollCard({
  postId,
  rows,
  closesAt,
}: {
  postId: string;
  rows: PollResult[];
  closesAt?: string | null;
}) {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [localResults, setLocalResults] = useState<Record<string, PollResult[]>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [changingVote, setChangingVote] = useState(false);
  const [burstTrigger, setBurstTrigger] = useState(0);
  const results = localResults[postId] ?? rows;

  const userVote = results[0]?.my_option ?? null;
  const total = results[0]?.total;
  const resultsVisible = results.some((row) => row.results_visible);
  const isOpen = results.length === 0 || results[0].is_open;

  async function reload() {
    const { rowsByPostId, error } = await loadPollResults([postId]);
    if (error) {
      setMessage(friendlyError(error, t));
      return;
    }
    setLocalResults((current) => ({ ...current, [postId]: rowsByPostId[postId] ?? [] }));
  }

  async function vote(optionId: string) {
    if (!user || busy || !isOpen || (userVote && !changingVote)) return;
    if (userVote === optionId) {
      setChangingVote(false);
      return;
    }
    setBusy(true);
    setMessage("");
    const previous = results;
    setLocalResults((current) => ({
      ...current,
      [postId]: results.map((row) => ({
        ...row,
        my_option: optionId,
        votes: row.votes === null ? null : row.votes + (row.option_id === optionId ? 1 : 0) - (row.option_id === userVote ? 1 : 0),
        total: row.total === null ? null : row.total + (userVote ? 0 : 1),
      })),
    }));
    if (userVote) {
      const { error: deleteError } = await supabase
        .from("poll_votes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      if (deleteError) {
        setLocalResults((current) => ({ ...current, [postId]: previous }));
        setMessage(friendlyError(deleteError, t));
        setBusy(false);
        setChangingVote(false);
        return;
      }
    }
    const { error } = await supabase.from("poll_votes").insert({ post_id: postId, option_id: optionId });
    if (error) {
      if (userVote) await reload();
      else setLocalResults((current) => ({ ...current, [postId]: previous }));
      setMessage(friendlyError(error, t));
      setBusy(false);
      setChangingVote(false);
      return;
    }
    await reload();
    setChangingVote(false);
    setBurstTrigger((current) => current + 1);
    showJoyLine(t("joy.voted"));
    setBusy(false);
  }

  return (
    <section className="relative space-y-3 rounded-2xl border border-[#CDBDEB] bg-white/80 p-4" aria-label={t("poll.add")}>
      <Burst variant="petals" trigger={burstTrigger} />
      <div className="space-y-2">
        {results.map((row) => {
          const count = row.votes ?? 0;
          const percentage = total && resultsVisible ? Math.round((count / total) * 100) : 0;
          return (
            <button
              key={row.option_id}
              type="button"
              className={`relative flex min-h-11 w-full items-center justify-between overflow-hidden rounded-xl border px-3 py-2 text-left text-sm font-medium text-deep-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${row.my_option !== null && row.option_id === row.my_option ? "border-[#8F72BE]" : "border-[#CDBDEB]"}`}
              onClick={() => void vote(row.option_id)}
              disabled={!isOpen || Boolean(userVote && !changingVote) || busy || !user}
              aria-pressed={row.my_option !== null && row.option_id === row.my_option}
            >
              {resultsVisible && (
                <span
                  className="poll-result-bar absolute inset-y-0 left-0 bg-soft-lilac/70"
                  style={{ width: `${percentage}%` }}
                  aria-hidden="true"
                />
              )}
              <span className="relative min-w-0 break-words">{row.label}{row.my_option !== null && row.option_id === row.my_option && <span className="ml-2 text-xs">· {t("poll.yourVote")}</span>}</span>
              {resultsVisible && <span className="relative ml-3 shrink-0 text-xs">{count} · {percentage}%</span>}
            </button>
          );
        })}
      </div>
      {!resultsVisible && <p className="break-words text-sm text-gray-600">{t("poll.hiddenResults")}</p>}
      {!isOpen && <p className="text-sm font-medium text-gray-700">{t("poll.closed")}</p>}
      {userVote && isOpen && (
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-deep-plum underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
          onClick={() => setChangingVote((current) => !current)}
          disabled={busy}
        >
          {t("poll.changeVote")}
        </button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-soft-lilac pt-2 text-xs text-gray-600">
        <span>{t("poll.privacyNote")}</span>
        {closesAt && <span>{t("poll.closesOn")} {new Date(closesAt).toLocaleDateString(lang === "am" ? "am-ET" : "en-US")}</span>}
      </div>
      {message && <p className="break-words text-sm text-red-700" role="alert">{message}</p>}
    </section>
  );
}
