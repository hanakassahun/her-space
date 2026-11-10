"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

type Opener = { id: string; title: string; created_at: string; series_cadence: "daily" | "weekly" | "monthly" | "whenever" };
type PartDate = { series_root_id: string; created_at: string };
const dismissKey = "seriesReminderDismissed";

export default function SeriesReminder() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [reminder, setReminder] = useState<Opener | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const hiddenThrough = window.localStorage.getItem(dismissKey);
        if (hiddenThrough && Date.now() < new Date(hiddenThrough).getTime()) return;
      } catch {
        // Continue showing reminders when local storage is unavailable.
      }
      const { data, error } = await supabase.from("posts")
        .select("id, title, created_at, series_cadence")
        .eq("author_id", user.id)
        .eq("is_series_opener", true)
        .eq("series_status", "active")
        .in("series_cadence", ["daily", "weekly", "monthly"]);
      if (!active) return;
      if (error) {
        setMessage(friendlyError(error, t));
        return;
      }
      const openers = (data ?? []) as Opener[];
      if (!openers.length) return;
      const ids = openers.map((row) => row.id);
      const { data: childRows, error: childrenError } = await supabase.from("posts")
        .select("series_root_id, created_at")
        .in("series_root_id", ids)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (childrenError) {
        setMessage(friendlyError(childrenError, t));
        return;
      }
      const latestByRoot = new Map<string, string>();
      for (const row of (childRows ?? []) as PartDate[]) {
        if (!latestByRoot.has(row.series_root_id)) latestByRoot.set(row.series_root_id, row.created_at);
      }
      const due = openers.find((opener) => {
        const elapsed = Date.now() - new Date(latestByRoot.get(opener.id) ?? opener.created_at).getTime();
        const threshold = opener.series_cadence === "daily" ? 2 : opener.series_cadence === "weekly" ? 8 : 31;
        return elapsed > threshold * 24 * 60 * 60 * 1000;
      });
      setReminder(due ?? null);
    })();
    return () => { active = false; };
  }, [t, user]);

  async function pause() {
    if (!reminder) return;
    const previous = reminder;
    setReminder(null);
    const { error } = await supabase.from("posts").update({ series_status: "paused" }).eq("id", reminder.id);
    if (error) {
      setReminder(previous);
      setMessage(friendlyError(error, t));
    }
  }

  function dismiss() {
    try {
      window.localStorage.setItem(dismissKey, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    } catch {
      // Dismiss for this page session when local storage is unavailable.
    }
    setReminder(null);
  }

  if (!reminder && !message) return null;
  return <Card className="space-y-3 border border-soft-lilac bg-soft-lilac/35">
    {reminder && <>
      <p className="break-words text-gray-700">{t("series.reminder")}</p>
      <Link className="block break-words font-semibold text-deep-plum underline" href={`/series/${reminder.id}`}>{reminder.title}</Link>
      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex min-h-11 items-center rounded-full gradient-aurora px-4 font-semibold text-white" href={`/new?series=${reminder.id}`}>{t("series.writeNext")}</Link>
        <Button type="button" variant="secondary" onClick={() => void pause()}>{t("series.pauseIt")}</Button>
        <Button type="button" variant="ghost" onClick={dismiss}>{t("series.notNow")}</Button>
      </div>
    </>}
    {message && <p className="break-words text-sm text-red-700" role="alert">{message}</p>}
  </Card>;
}
