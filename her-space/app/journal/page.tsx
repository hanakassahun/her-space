"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import SuccessCheck from "@/components/ui/SuccessCheck";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";
import JournalTabs from "@/components/journal/JournalTabs";
import { isValidDateString } from "@/lib/cycle";
import type { TranslationKey } from "@/lib/i18n/en";
import Burst from "@/components/Burst";
import { showJoyLine } from "@/lib/joy";
import DecorativeEmptyArt from "@/components/DecorativeEmptyArt";

type PeriodStatus = "none" | "spotting" | "light" | "medium" | "heavy";

type JournalEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  period_status: PeriodStatus | null;
  symptoms: string[];
  notes: string;
  created_at: string;
};

type EntryDraft = {
  mood: number | null;
  energy: number | null;
  sleepHours: string;
  periodStatus: PeriodStatus | null;
  symptoms: string[];
  notes: string;
};

const symptomOptions = [
  "cramps",
  "headache",
  "bloating",
  "acne",
  "fatigue",
  "nausea",
  "mood swings",
  "back pain",
  "tender breasts",
  "discharge changes",
];

const periodOptions: PeriodStatus[] = ["none", "spotting", "light", "medium", "heavy"];

const symptomTranslationKeys: Record<string, TranslationKey> = {
  cramps: "symptom.cramps",
  headache: "symptom.headache",
  bloating: "symptom.bloating",
  acne: "symptom.acne",
  fatigue: "symptom.fatigue",
  nausea: "symptom.nausea",
  "mood swings": "symptom.moodSwings",
  "back pain": "symptom.backPain",
  "tender breasts": "symptom.tenderBreasts",
  "discharge changes": "symptom.dischargeChanges",
};

const periodTranslationKeys: Record<PeriodStatus, TranslationKey> = {
  none: "common.periodNone",
  spotting: "common.periodSpotting",
  light: "common.periodLight",
  medium: "common.periodMedium",
  heavy: "common.periodHeavy",
};

const emptyDraft: EntryDraft = {
  mood: null,
  energy: null,
  sleepHours: "",
  periodStatus: null,
  symptoms: [],
  notes: "",
};

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function draftFromEntry(entry: JournalEntry): EntryDraft {
  return {
    mood: entry.mood,
    energy: entry.energy,
    sleepHours: entry.sleep_hours === null ? "" : String(entry.sleep_hours),
    periodStatus: entry.period_status,
    symptoms: entry.symptoms ?? [],
    notes: entry.notes ?? "",
  };
}

async function fetchJournalEntries(userId: string) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, user_id, entry_date, mood, energy, sleep_hours, period_status, symptoms, notes, created_at")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false });

  return { data: (data ?? []) as JournalEntry[], error };
}

export default function JournalPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, router, user]);

  if (authLoading || !user) {
    return (
      <PageShell className="max-w-3xl px-4 py-6 md:px-6 md:py-10">
        <p className="text-gray-700">{t("journal.loading")}</p>
      </PageShell>
    );
  }

  return <JournalContent key={user.id} userId={user.id} />;
}

function JournalContent({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [customSymptom, setCustomSymptom] = useState("");
  const [entryDate, setEntryDate] = useState(getLocalDate);
  const [editingPastDate, setEditingPastDate] = useState<string | null>(null);
  const [selectedQueryDate, setSelectedQueryDate] = useState<string | null>(null);
  const [returnToCalendar, setReturnToCalendar] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [journalBurstTrigger, setJournalBurstTrigger] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function initializeJournal() {
      const params = new URLSearchParams(window.location.search);
      const requestedDate = params.get("date");
      const queryDate = requestedDate && isValidDateString(requestedDate) && requestedDate <= getLocalDate()
        ? requestedDate
        : null;
      const fromCalendar = queryDate !== null && params.get("from") === "calendar";
      setSelectedQueryDate(queryDate);
      setReturnToCalendar(fromCalendar);
      setEntryDate(queryDate ?? getLocalDate());
      const { data, error } = await fetchJournalEntries(userId);
      if (!active) return;
      if (error) {
        setMessage(friendlyError(error, t));
      } else {
        setEntries(data);
        const selectedEntry = data.find((entry) => entry.entry_date === (queryDate ?? getLocalDate()));
        setDraft(selectedEntry ? draftFromEntry(selectedEntry) : emptyDraft);
      }
      setLoading(false);
    }

    void initializeJournal();
    return () => {
      active = false;
    };
  }, [router, t, userId]);

  function toggleSymptom(symptom: string) {
    setDraft((current) => ({
      ...current,
      symptoms: current.symptoms.includes(symptom)
        ? current.symptoms.filter((item) => item !== symptom)
        : [...current.symptoms, symptom],
    }));
  }

  function addCustomSymptom() {
    const symptoms = customSymptom
      .split(/[,،፣]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (symptoms.length === 0) return;

    setDraft((current) => ({
      ...current,
      symptoms: [
        ...current.symptoms,
        ...symptoms.filter((symptom) => !current.symptoms.some((item) => item.toLowerCase() === symptom.toLowerCase())),
      ],
    }));
    setCustomSymptom("");
  }

  function editEntry(entry: JournalEntry) {
    setSelectedQueryDate(null);
    setReturnToCalendar(false);
    setEntryDate(entry.entry_date);
    setEditingPastDate(entry.entry_date === getLocalDate() ? null : entry.entry_date);
    setDraft(draftFromEntry(entry));
    setExpandedEntryId(entry.id);
    document.getElementById("journal-today")?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelPastEdit() {
    setSelectedQueryDate(null);
    setReturnToCalendar(false);
    setEditingPastDate(null);
    setEntryDate(getLocalDate());
    const todayEntry = entries.find((entry) => entry.entry_date === getLocalDate());
    setDraft(todayEntry ? draftFromEntry(todayEntry) : emptyDraft);
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;

    setSaving(true);
    setMessage("");
    setSaveSucceeded(false);
    const { error } = await supabase.from("journal_entries").upsert(
      {
        user_id: userId,
        entry_date: entryDate,
        mood: draft.mood,
        energy: draft.energy,
        sleep_hours: draft.sleepHours === "" ? null : Number(draft.sleepHours),
        period_status: draft.periodStatus,
        symptoms: draft.symptoms,
        notes: draft.notes,
      },
      { onConflict: "user_id,entry_date" }
    );

    if (error) {
      setMessage(friendlyError(error, t));
    } else {
      setMessage(t("journal.saved"));
      setSaveSucceeded(true);
      setJournalBurstTrigger((current) => current + 1);
      showJoyLine(t("joy.logged"));
      if (!selectedQueryDate) {
        setEditingPastDate(null);
        setEntryDate(getLocalDate());
      }
      const { data, error: refreshError } = await fetchJournalEntries(userId);
      if (refreshError) {
        setSaveSucceeded(false);
        setMessage(friendlyError(refreshError, t));
      } else {
        setEntries(data);
        const currentEntry = data.find((entry) => entry.entry_date === (selectedQueryDate ?? getLocalDate()));
        setDraft(currentEntry ? draftFromEntry(currentEntry) : emptyDraft);
      }
    }
    setSaving(false);
  }

  const today = getLocalDate();
  const thisMonth = today.slice(0, 7);
  const thisMonthEntryCount = entries.filter((entry) => entry.entry_date.startsWith(thisMonth)).length;
  const pastEntries = entries.filter((entry) => entry.entry_date < today);

  return (
    <PageShell className="max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-deep-plum">{t("journal.title")}</h1>
            {thisMonthEntryCount > 0 && (
              <p className="mt-1 text-sm text-gray-600">
                {thisMonthEntryCount} {t("journal.monthCount")}
              </p>
            )}
        </div>
        <p className="inline-flex items-center gap-2 text-sm font-medium text-deep-plum">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          {t("journal.private")}
        </p>
      </header>

      <JournalTabs />

      <Card as="section" id="journal-today" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-deep-plum">
              {selectedQueryDate
                ? t("journal.editingDate")
                : editingPastDate
                  ? `${t("journal.editingDate")} ${formatDate(editingPastDate)}`
                  : t("journal.today")}
            </p>
            <h2 className="text-xl font-semibold text-deep-plum">
              {formatDate(selectedQueryDate ?? editingPastDate ?? today)}
            </h2>
          </div>
          {editingPastDate && !selectedQueryDate && (
            <Button variant="ghost" className="text-sm" type="button" onClick={cancelPastEdit}>
              {t("journal.cancelEdit")}
            </Button>
          )}
        </div>

        <form className="space-y-5" onSubmit={saveEntry}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-deep-plum">{t("journal.mood")}</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button
                  className="!h-11 !w-11 !min-w-11 !px-0"
                  variant={draft.mood === value ? "primary" : "secondary"}
                  key={value}
                  type="button"
                  aria-pressed={draft.mood === value}
                  onClick={() => setDraft((current) => ({ ...current, mood: value }))}
                >
                  {value}
                </Button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>{t("journal.low")}</span>
              <span>{t("journal.high")}</span>
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-deep-plum">{t("journal.energy")}</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button
                  className="!h-11 !w-11 !min-w-11 !px-0"
                  variant={draft.energy === value ? "primary" : "secondary"}
                  key={value}
                  type="button"
                  aria-pressed={draft.energy === value}
                  onClick={() => setDraft((current) => ({ ...current, energy: value }))}
                >
                  {value}
                </Button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>{t("journal.low")}</span>
              <span>{t("journal.high")}</span>
            </div>
          </fieldset>

          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            {t("journal.sleepHours")}
            <Input
              type="number"
              min="0"
              max="24"
              step="0.1"
              inputMode="decimal"
              value={draft.sleepHours}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sleepHours: event.target.value }))
              }
              placeholder={t("journal.sleepPlaceholder")}
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-deep-plum">{t("journal.periodStatus")}</legend>
            <div className="flex flex-wrap gap-2">
              {periodOptions.map((status) => (
                <Button
                  className="text-sm"
                  variant={draft.periodStatus === status ? "primary" : "secondary"}
                  key={status}
                  type="button"
                  aria-pressed={draft.periodStatus === status}
                  onClick={() =>
                    setDraft((current) => ({ ...current, periodStatus: status }))
                  }
                >
                  {t(periodTranslationKeys[status])}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-deep-plum">{t("journal.symptoms")}</legend>
            <div className="flex flex-wrap gap-2">
              {symptomOptions.map((symptom) => {
                const selected = draft.symptoms.includes(symptom);
                return (
                  <Button
                    className="text-sm"
                    variant={selected ? "primary" : "secondary"}
                    key={symptom}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSymptom(symptom)}
                  >
                    {t(symptomTranslationKeys[symptom])}
                  </Button>
                );
              })}
              {draft.symptoms
                .filter((symptom) => !symptomOptions.includes(symptom))
                .map((symptom) => (
                  <Button
                    className="text-sm"
                    key={symptom}
                    type="button"
                    aria-pressed="true"
                    onClick={() => toggleSymptom(symptom)}
                  >
                    {symptom} ×
                  </Button>
                ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={customSymptom}
                onChange={(event) => setCustomSymptom(event.target.value)}
                placeholder={t("journal.customSymptom")}
                aria-label={t("journal.customSymptomLabel")}
              />
              <Button variant="secondary" type="button" onClick={addCustomSymptom}>
                {t("journal.add")}
              </Button>
            </div>
          </fieldset>

          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            {t("journal.notes")}
            <Textarea
              className="min-h-32"
              maxLength={3000}
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder={t("journal.notesPlaceholder")}
            />
          </label>

          {message && (
            <div className="text-sm text-deep-plum" role="status">
              <div className="flex items-center gap-2">
                {saveSucceeded && <span className="relative inline-flex"><SuccessCheck /><Burst variant="petals" trigger={journalBurstTrigger} /></span>}
                <FriendlyErrorMessage message={message} />
              </div>
            </div>
          )}
          <Button className="w-full" type="submit" disabled={saving || loading}>
            {saving ? t("journal.saving") : editingPastDate || selectedQueryDate ? t("journal.saveChanges") : t("journal.saveToday")}
          </Button>
        </form>
        {returnToCalendar && saveSucceeded && (
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-deep-plum underline underline-offset-4" href="/journal/calendar">
            {t("cal.backToCalendar")}
          </Link>
        )}
      </Card>

      <section className="space-y-4" aria-labelledby="past-entries-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="past-entries-heading" className="text-xl font-semibold text-deep-plum">
            {t("journal.pastEntries")}
          </h2>
          <Badge variant="lilac">{pastEntries.length}</Badge>
        </div>

        {loading && <p className="text-gray-700">{t("journal.loading")}</p>}
        {!loading && pastEntries.length === 0 && (
          <Card className="space-y-2 text-gray-700">
            <DecorativeEmptyArt variant="sprout" />
            <p>{t("journal.earlierEmpty")}</p>
            <p className="text-sm text-gray-600">{t("empty.journalHint")}</p>
          </Card>
        )}

        {pastEntries.map((entry) => {
          const expanded = expandedEntryId === entry.id;
          return (
            <Card as="article" key={entry.id} className="space-y-3">
              <Button
                variant="ghost"
                className="w-full justify-between text-left"
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedEntryId(expanded ? null : entry.id)}
              >
                <span className="font-semibold">{formatDate(entry.entry_date)}</span>
                <span className="text-sm text-gray-600">
                  {entry.symptoms.length ? `${entry.symptoms.length} ${t("journal.symptomCount")}` : t("journal.noSymptoms")}
                </span>
              </Button>

              {expanded && (
                <div className="space-y-4 border-t border-white/70 pt-4">
                  <dl className="grid grid-cols-2 gap-3 text-sm text-deep-plum sm:grid-cols-4">
                    <div><dt className="text-gray-600">{t("journal.moodLabel")}</dt><dd>{entry.mood ?? "—"}/5</dd></div>
                    <div><dt className="text-gray-600">{t("journal.energyLabel")}</dt><dd>{entry.energy ?? "—"}/5</dd></div>
                    <div><dt className="text-gray-600">{t("journal.sleepLabel")}</dt><dd>{entry.sleep_hours === null ? "—" : `${entry.sleep_hours}h`}</dd></div>
                    <div><dt className="text-gray-600">{t("journal.periodLabel")}</dt><dd>{entry.period_status ? t(periodTranslationKeys[entry.period_status]) : "—"}</dd></div>
                  </dl>
                  {entry.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {entry.symptoms.map((symptom) => (
                        <Badge variant="lilac" key={symptom}>{symptomTranslationKeys[symptom] ? t(symptomTranslationKeys[symptom]) : symptom}</Badge>
                      ))}
                    </div>
                  )}
                  {entry.notes && <p className="whitespace-pre-wrap text-sm text-gray-700">{entry.notes}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" type="button" onClick={() => editEntry(entry)}>
                      {t("journal.editEntry")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </section>
    </PageShell>
  );
}