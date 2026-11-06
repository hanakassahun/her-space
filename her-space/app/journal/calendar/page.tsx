"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import JournalTabs from "@/components/journal/JournalTabs";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import {
  addDaysUTC,
  findPeriodStarts,
  FLOW_STYLE,
  lateState,
  normalizeSymptomKey,
  predictNext,
  SYMPTOM_COLORS,
  topSymptoms,
  type CycleEntry,
} from "@/lib/cycle";
import type { TranslationKey } from "@/lib/i18n/en";

type CalendarEntry = CycleEntry & {
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  notes: string | null;
};

const symptomTranslation: Record<string, TranslationKey> = {
  cramps: "symptom.cramps",
  headache: "symptom.headache",
  bloating: "symptom.bloating",
  acne: "symptom.acne",
  fatigue: "symptom.fatigue",
  nausea: "symptom.nausea",
  mood_swings: "symptom.moodSwings",
  back_pain: "symptom.backPain",
  tender_breasts: "symptom.tenderBreasts",
  discharge_changes: "symptom.dischargeChanges",
};

const periodTranslation: Record<string, TranslationKey> = {
  none: "common.periodNone",
  spotting: "common.periodSpotting",
  light: "common.periodLight",
  medium: "common.periodMedium",
  heavy: "common.periodHeavy",
};

const knownSymptoms = [
  "cramps",
  "headache",
  "bloating",
  "acne",
  "fatigue",
  "nausea",
  "mood_swings",
  "back_pain",
  "tender_breasts",
  "discharge_changes",
];

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function symptomLabel(symptom: string, t: (key: TranslationKey) => string): string {
  const key = normalizeSymptomKey(symptom);
  return symptomTranslation[key] ? t(symptomTranslation[key]) : symptom;
}

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatEthiopianDate(date: string): string | null {
  try {
    return new Intl.DateTimeFormat("am-ET-u-ca-ethiopic", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
  } catch {
    return null;
  }
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function JournalCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, router, user]);

  if (authLoading || !user) {
    return (
      <PageShell className="max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <p className="text-gray-700">{t("journal.loading")}</p>
      </PageShell>
    );
  }

  return <CalendarContent key={user.id} userId={user.id} />;
}

function CalendarContent({ userId }: { userId: string }) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const translation = useRef(t);
  const today = localToday();
  const locale = lang === "am" ? "am-ET" : "en-US";
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pastDate, setPastDate] = useState("");

  useEffect(() => {
    translation.current = t;
  }, [t]);

  useEffect(() => {
    let active = true;
    const from = addDaysUTC(localToday(), -400);

    void supabase
      .from("journal_entries")
      .select("entry_date, period_status, symptoms, mood, energy, sleep_hours, notes")
      .eq("user_id", userId)
      .gte("entry_date", from)
      .order("entry_date", { ascending: true })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError(friendlyError(queryError, translation.current));
        } else {
          setEntries((data ?? []) as CalendarEntry[]);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1)));
  const weekdayNames = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(2023, 0, 1 + index)))
  );
  const dates = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    const total = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstWeekday + 1;
      return addDaysUTC(
        `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`,
        day - 1
      );
    }).slice(0, Math.ceil((firstWeekday + total) / 7) * 7);
  }, [monthIndex, year]);
  const entryByDate = useMemo(
    () => new Map(entries.map((entry) => [entry.entry_date, entry])),
    [entries]
  );
  const starts = useMemo(() => findPeriodStarts(entries), [entries]);
  const prediction = useMemo(() => predictNext(starts, today), [starts, today]);
  const estimateState = lateState(prediction, entries, today);
  const thisMonthFlowDays = entries.filter((entry) =>
    entry.entry_date.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`)
    && ["light", "medium", "heavy"].includes(entry.period_status ?? "")
  ).length;
  const symptoms = topSymptoms(entries, 90, 3, today);
  const selectedEntry = selectedDate ? entryByDate.get(selectedDate) : undefined;
  const linkDate = selectedDate ?? today;

  function moveMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function goToPastDate() {
    if (!pastDate || pastDate > today) return;
    router.push(`/journal?date=${pastDate}&from=calendar`);
  }

  return (
    <PageShell className="max-w-4xl space-y-5 px-3 py-5 sm:px-4 md:px-6 md:py-10">
      <header className="space-y-4">
        <h1 className="break-words text-3xl font-bold text-deep-plum">{t("cal.title")}</h1>
        <JournalTabs />
      </header>

      {error && <p className="break-words text-sm text-red-700" role="alert">{error}</p>}

      <Card className="space-y-4 p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-soft-lilac bg-white text-xl text-deep-plum"
            aria-label={t("cal.prev")}
            onClick={() => moveMonth(-1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <h2 className="min-w-0 flex-1 break-words text-center text-xl font-semibold text-deep-plum" aria-live="polite">
            {monthTitle}
          </h2>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-soft-lilac bg-white text-xl text-deep-plum"
            aria-label={t("cal.next")}
            onClick={() => moveMonth(1)}
          >
            <span aria-hidden="true">›</span>
          </button>
          <Button type="button" variant="secondary" className="px-3" onClick={() => setMonth(firstOfMonth(new Date()))}>
            {t("journal.today")}
          </Button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-gray-600">{t("journal.loading")}</p>
        ) : (
          <div role="grid" aria-label={monthTitle} className="grid grid-cols-7 gap-1">
            <div role="row" className="contents">
              {weekdayNames.map((name, index) => (
                <div role="columnheader" key={`${name}-${index}`} className="min-w-0 py-2 text-center text-xs font-medium text-gray-600">
                  <span className="break-words">{name}</span>
                </div>
              ))}
            </div>
            {Array.from({ length: dates.length / 7 }, (_, weekIndex) => (
              <div role="row" key={weekIndex} className="contents">
                {dates.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
                  const entry = entryByDate.get(date);
                  const flow = entry?.period_status ?? null;
                  const flowDay = flow !== null && ["spotting", "light", "medium", "heavy"].includes(flow);
                  const flowStyle = flow === "spotting"
                    ? "after:absolute after:inset-1 after:rounded-full after:bg-rose-200 after:content-['']"
                    : flow ? FLOW_STYLE[flow] : "";
                  const daySymptoms = entry?.symptoms ?? [];
                  const isToday = date === today;
                  const isCurrentMonth = date.slice(0, 7) === `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
                  const isFuture = date > today;
                  const estimated = prediction.status === "ok"
                    && date >= prediction.rangeStart
                    && date <= prediction.rangeEnd;
                  const detailParts = [
                    formatDate(date, locale),
                    flow ? t(periodTranslation[flow] ?? "common.periodNone") : "",
                    ...daySymptoms.map((symptom) => symptomLabel(symptom, t)),
                  ].filter(Boolean);

                  return (
                    <button
                      type="button"
                      role="gridcell"
                      key={date}
                      disabled={isFuture}
                      aria-label={detailParts.join(", ")}
                      aria-current={isToday ? "date" : undefined}
                      onClick={() => setSelectedDate(date)}
                      className={`relative flex min-h-[58px] min-w-0 flex-col items-center justify-start gap-0.5 rounded-xl border p-0.5 text-deep-plum focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-periwinkle disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[68px] ${isCurrentMonth ? "bg-white/55" : "bg-white/25"} ${estimated ? "border-dashed border-violet-400" : "border-transparent"} ${selectedDate === date ? "ring-1 ring-deep-plum/60" : ""}`}
                    >
                      <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${flowDay ? flowStyle : ""} ${isToday ? "ring-2 ring-offset-1 ring-[#74B8B8]" : ""}`}>
                        <span className="relative z-10">{Number(date.slice(-2))}</span>
                      </span>
                      <span className="flex min-h-2 items-center justify-center gap-0.5" aria-hidden="true">
                        {daySymptoms.slice(0, 3).map((symptom, index) => {
                          const key = normalizeSymptomKey(symptom);
                          return <span key={`${key}-${index}`} className={`h-1.5 w-1.5 rounded-full ${SYMPTOM_COLORS[key]}`} />;
                        })}
                        {daySymptoms.length > 3 && (
                          <span className="text-[9px] leading-none text-gray-700">+{daySymptoms.length - 3}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <details className="rounded-2xl border border-white/80 bg-white/45 px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-deep-plum">
            {t("cal.legend")}
          </summary>
          <div className="space-y-3 pb-3 text-sm text-gray-700">
            <div className="flex flex-wrap gap-3">
              {(["spotting", "light", "medium", "heavy"] as const).map((status) => (
                <span key={status} className="inline-flex min-h-11 items-center gap-2">
                  <span className={`relative h-6 w-6 rounded-full ${status === "spotting" ? "after:absolute after:inset-1 after:rounded-full after:bg-rose-200 after:content-['']" : FLOW_STYLE[status]}`} />
                  {t(periodTranslation[status])}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {knownSymptoms.map((symptom) => (
                <span key={symptom} className="inline-flex min-h-11 items-center gap-1.5 break-words">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${SYMPTOM_COLORS[symptom]}`} />
                  {symptomTranslation[symptom] ? t(symptomTranslation[symptom]) : symptom}
                </span>
              ))}
            </div>
            <span className="inline-flex min-h-11 items-center gap-2">
              <span className="h-6 w-6 rounded-lg border-2 border-dashed border-violet-400" />
              {t("cal.estimated")}
            </span>
          </div>
        </details>

        <div className="flex flex-wrap items-end gap-2 border-t border-soft-lilac/60 pt-3">
          <label className="min-w-0 flex-1 space-y-1 text-sm font-medium text-deep-plum">
            <span className="block break-words">{t("cal.addPast")}</span>
            <input
              className="min-h-11 w-full rounded-xl border border-[#CDBDEB] bg-white px-3 text-deep-plum"
              type="date"
              max={today}
              value={pastDate}
              onChange={(event) => setPastDate(event.target.value)}
            />
          </label>
          <Button type="button" variant="secondary" disabled={!pastDate || pastDate > today} onClick={goToPastDate}>
            {t("cal.addPast")}
          </Button>
        </div>
      </Card>

      {selectedDate && (
        <Card className="space-y-4">
          <div className="space-y-1">
            <h2 className="break-words text-xl font-semibold text-deep-plum">{formatDate(selectedDate, locale)}</h2>
            {formatEthiopianDate(selectedDate) && (
              <p className="break-words text-sm text-gray-600">{formatEthiopianDate(selectedDate)}</p>
            )}
          </div>
          {!selectedEntry ? (
            <p className="text-gray-700">{t("cal.dayEmpty")}</p>
          ) : (
            <div className="space-y-3">
              <dl className="grid grid-cols-1 gap-3 text-sm text-deep-plum sm:grid-cols-2">
                <div><dt className="text-gray-600">{t("journal.periodLabel")}</dt><dd>{selectedEntry.period_status ? t(periodTranslation[selectedEntry.period_status] ?? "common.periodNone") : "—"}</dd></div>
                <div><dt className="text-gray-600">{t("journal.moodLabel")}</dt><dd>{selectedEntry.mood ?? "—"}/5</dd></div>
                <div><dt className="text-gray-600">{t("journal.energyLabel")}</dt><dd>{selectedEntry.energy ?? "—"}/5</dd></div>
                <div><dt className="text-gray-600">{t("journal.sleepLabel")}</dt><dd>{selectedEntry.sleep_hours === null ? "—" : `${selectedEntry.sleep_hours}h`}</dd></div>
              </dl>
              {selectedEntry.symptoms?.length ? (
                <div>
                  <h3 className="text-sm font-medium text-deep-plum">{t("journal.symptoms")}</h3>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {selectedEntry.symptoms.map((symptom, index) => (
                      <li key={`${symptom}-${index}`} className="break-words rounded-full bg-soft-lilac/70 px-3 py-1 text-sm text-deep-plum">
                        {symptomLabel(symptom, t)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {selectedEntry.notes && (
                <div>
                  <h3 className="text-sm font-medium text-deep-plum">{t("journal.notes")}</h3>
                  <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{selectedEntry.notes}</p>
                </div>
              )}
            </div>
          )}
          <Link
            href={`/journal?date=${linkDate}&from=calendar`}
            className="gradient-aurora inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 py-2 text-center text-sm font-semibold text-white sm:w-auto"
          >
            {selectedEntry ? t("cal.editDay") : t("cal.logDay")}
          </Link>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-deep-plum">{t("cal.yourCycle")}</h2>
          {starts.length > 0 && (
            <p className="break-words text-sm text-gray-700">
              {t("cal.lastPeriodStart")}: {formatDate(starts[starts.length - 1].start, locale)}
            </p>
          )}
          {prediction.status === "ok" ? (
            <>
              <p className="break-words text-sm text-gray-700">
                {t("cal.typicalLength")}: {prediction.typicalLength} {t("cal.days")}
              </p>
              <p className="break-words font-medium text-deep-plum">
                {t("cal.nextEstimate")}: {formatDate(prediction.rangeStart, locale)} – {formatDate(prediction.rangeEnd, locale)}
              </p>
              {prediction.irregular && <p className="break-words text-sm text-gray-700">{t("cal.irregular")}</p>}
            </>
          ) : (
            <p className="break-words text-sm text-gray-700">{t("cal.notEnough")}</p>
          )}
          {estimateState === "late" && <p className="break-words text-sm text-gray-700">{t("cal.late")}</p>}
          {estimateState === "long_gap" && <p className="break-words text-sm text-gray-700">{t("cal.longGap")}</p>}
          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-deep-plum underline underline-offset-4" href="/learn">
            {t("cal.learnLink")}
          </Link>
          <p className="break-words text-xs leading-5 text-gray-600">{t("cal.disclaimer")}</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-deep-plum">{t("cal.thisMonth")}</h2>
          <p className="break-words text-sm text-gray-700">
            {thisMonthFlowDays} {t("cal.flowDays")}
          </p>
          <h3 className="break-words text-sm font-medium text-deep-plum">{t("cal.topSymptoms")}</h3>
          {symptoms.length === 0 ? (
            <p className="text-sm text-gray-600">—</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {symptoms.map(({ symptom, count }) => (
                <li key={symptom} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm text-deep-plum">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${SYMPTOM_COLORS[symptom]}`} />
                  <span className="break-words">{symptomTranslation[symptom] ? t(symptomTranslation[symptom]) : symptom}: {count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="break-words text-xs leading-5 text-gray-600">{t("cal.privacy")}</p>
        </Card>
      </div>
    </PageShell>
  );
}
