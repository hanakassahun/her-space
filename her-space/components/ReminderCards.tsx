"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import {
  addDaysUTC,
  findPeriodStarts,
  headsUp,
  predictNext,
  type CycleEntry,
} from "@/lib/cycle";

type ReminderEntry = CycleEntry & {
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  notes: string | null;
};

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function ReminderCards() {
  const { user, remindLog, remindPeriod } = useAuth();
  const { lang, t } = useLanguage();
  const [queryResult, setQueryResult] = useState<{
    key: string;
    entries: ReminderEntry[];
    error: string;
  } | null>(null);
  const [dismissedLog, setDismissedLog] = useState(false);
  const [dismissedPeriod, setDismissedPeriod] = useState(false);
  const translation = useRef(t);
  const today = localToday();
  const queryKey = `${user?.id ?? ""}:${today}:${remindLog}:${remindPeriod}`;

  useEffect(() => {
    translation.current = t;
  }, [t]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let active = true;
    const from = addDaysUTC(today, -400);

    void supabase
      .from("journal_entries")
      .select("entry_date, period_status, symptoms, mood, energy, sleep_hours, notes")
      .eq("user_id", userId)
      .gte("entry_date", from)
      .order("entry_date", { ascending: true })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setQueryResult({
          key: queryKey,
          entries: (data ?? []) as ReminderEntry[],
          error: queryError ? friendlyError(queryError, translation.current) : "",
        });
      });

    return () => {
      active = false;
    };
  }, [queryKey, today, user?.id]);

  useEffect(() => {
    if (!user?.id || (!remindLog && !remindPeriod)) return;
    const frame = window.requestAnimationFrame(() => {
      setDismissedLog(window.localStorage.getItem("remindLogDismissed") === `dismissed:${today}`);
      setDismissedPeriod(window.localStorage.getItem("remindPeriodDismissed") === `dismissed:${today}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [remindLog, remindPeriod, today, user?.id]);

  if (!user || (!remindLog && !remindPeriod)) return null;

  const currentResult = queryResult?.key === queryKey ? queryResult : null;
  const entries = currentResult?.entries ?? [];
  const error = currentResult?.error ?? "";
  const loading = currentResult === null;
  const todayEntry = entries.some((entry) => entry.entry_date === today);
  const starts = findPeriodStarts(entries);
  const prediction = predictNext(starts, today);
  const showLog = !loading && !error && remindLog && !todayEntry && !dismissedLog;
  const showPeriod = !loading && !error && remindPeriod && headsUp(prediction, entries, today) && !dismissedPeriod;
  const locale = lang === "am" ? "am-ET" : "en";
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

  if (!showLog && !showPeriod && !error) return null;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {showLog && (
        <Card className="space-y-3">
          <p className="break-words text-deep-plum">{t("remind.cardLog")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/journal" className="gradient-aurora inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-white">
              {t("remind.cardLogButton")}
            </Link>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                window.localStorage.setItem("remindLogDismissed", `dismissed:${today}`);
                setDismissedLog(true);
              }}
            >
              {t("remind.dismiss")}
            </Button>
          </div>
        </Card>
      )}
      {showPeriod && prediction.status === "ok" && (
        <Card className="space-y-3">
          <p className="break-words text-deep-plum">{t("remind.cardPeriod")}</p>
          <p className="break-words text-sm text-gray-700">
            {formatDate(prediction.rangeStart)} – {formatDate(prediction.rangeEnd)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/journal/calendar" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#CDBDEB] bg-white px-5 py-2 text-sm font-semibold text-deep-plum">
              {t("cal.tabCalendar")}
            </Link>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                window.localStorage.setItem("remindPeriodDismissed", `dismissed:${today}`);
                setDismissedPeriod(true);
              }}
            >
              {t("remind.dismiss")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
