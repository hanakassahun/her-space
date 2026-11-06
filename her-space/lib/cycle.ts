export type CycleEntry = {
  entry_date: string;
  period_status: string | null;
  symptoms?: string[] | null;
};

export type PeriodStart = {
  start: string;
  end: string;
  length: number;
};

export type CyclePrediction =
  | { status: "not_enough" }
  | { status: "stale" }
  | {
      status: "ok";
      predictedStart: string;
      rangeStart: string;
      rangeEnd: string;
      typicalLength: number;
      irregular: boolean;
      lastStart: string;
    };

export type LateState = "late" | "long_gap" | "none";

const FLOW_STATUSES = new Set(["light", "medium", "heavy"]);

const SYMPTOM_PALETTE = [
  "bg-rose-600",
  "bg-amber-600",
  "bg-sky-700",
  "bg-violet-700",
  "bg-emerald-700",
  "bg-orange-700",
  "bg-fuchsia-700",
  "bg-cyan-800",
  "bg-indigo-700",
  "bg-lime-800",
  "bg-slate-700",
] as const;

export const SYMPTOM_COLORS: Record<string, string> = {
  cramps: SYMPTOM_PALETTE[0],
  headache: SYMPTOM_PALETTE[1],
  bloating: SYMPTOM_PALETTE[2],
  acne: SYMPTOM_PALETTE[3],
  fatigue: SYMPTOM_PALETTE[4],
  nausea: SYMPTOM_PALETTE[5],
  mood_swings: SYMPTOM_PALETTE[6],
  back_pain: SYMPTOM_PALETTE[7],
  tender_breasts: SYMPTOM_PALETTE[8],
  discharge_changes: SYMPTOM_PALETTE[9],
  custom: SYMPTOM_PALETTE[10],
};

export const FLOW_STYLE: Record<string, string> = {
  spotting: "after:absolute after:inset-1 after:rounded-full after:bg-rose-200 after:content-['']",
  light: "bg-rose-200",
  medium: "bg-rose-300",
  heavy: "bg-rose-400",
};

export function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  return Math.floor(parsed.getTime() / 86_400_000);
}

export function dateFromDayNumber(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

export function addDaysUTC(date: string, days: number): string {
  return dateFromDayNumber(dayNumber(date) + days);
}

export function daysBetween(start: string, end: string): number {
  return dayNumber(end) - dayNumber(start);
}

export function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function findPeriodStarts(entries: CycleEntry[]): PeriodStart[] {
  const flowDates = [...new Set(entries
    .filter((entry) => entry.period_status && FLOW_STATUSES.has(entry.period_status))
    .map((entry) => entry.entry_date))]
    .sort();
  const periods: PeriodStart[] = [];

  for (const date of flowDates) {
    const current = periods[periods.length - 1];
    if (!current || daysBetween(current.end, date) >= 3) {
      periods.push({ start: date, end: date, length: 1 });
    } else {
      current.end = date;
      current.length = daysBetween(current.start, current.end) + 1;
    }
  }
  return periods;
}

export function cycleLengths(starts: PeriodStart[]): number[] {
  return starts
    .slice(1)
    .map((period, index) => daysBetween(starts[index].start, period.start))
    .filter((length) => length >= 15 && length <= 60)
    .slice(-6);
}

export function predictNext(starts: PeriodStart[], today: string): CyclePrediction {
  const lengths = cycleLengths(starts);
  if (lengths.length < 2) return { status: "not_enough" };

  const lastStart = starts[starts.length - 1]?.start;
  if (!lastStart) return { status: "not_enough" };
  if (daysBetween(lastStart, today) > 60) return { status: "stale" };

  const sorted = [...lengths].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  const typicalLength = Math.round(median);
  const spread = Math.max(2, Math.ceil((sorted[sorted.length - 1] - sorted[0]) / 2));
  const predictedStart = addDaysUTC(lastStart, typicalLength);

  return {
    status: "ok",
    predictedStart,
    rangeStart: addDaysUTC(predictedStart, -spread),
    rangeEnd: addDaysUTC(predictedStart, spread),
    typicalLength,
    irregular: sorted[sorted.length - 1] - sorted[0] > 10,
    lastStart,
  };
}

function hasFlowAfter(entries: CycleEntry[], start: string): boolean {
  return entries.some((entry) =>
    entry.entry_date > start
    && entry.period_status !== null
    && FLOW_STATUSES.has(entry.period_status)
  );
}

function lastPeriodStart(prediction: CyclePrediction, entries: CycleEntry[]): string | null {
  if (prediction.status === "ok") return prediction.lastStart;
  return findPeriodStarts(entries).at(-1)?.start ?? null;
}

export function lateState(
  prediction: CyclePrediction,
  entries: CycleEntry[],
  today: string
): LateState {
  const lastStart = lastPeriodStart(prediction, entries);
  if (!lastStart) return "none";
  if (daysBetween(lastStart, today) > 90) return "long_gap";
  if (
    prediction.status === "ok"
    && daysBetween(prediction.rangeEnd, today) > 7
    && !hasFlowAfter(entries, lastStart)
  ) return "late";
  return "none";
}

export function headsUp(
  prediction: CyclePrediction,
  entries: CycleEntry[],
  today: string
): boolean {
  return prediction.status === "ok"
    && today >= addDaysUTC(prediction.rangeStart, -2)
    && today <= prediction.rangeEnd
    && !hasFlowAfter(entries, prediction.lastStart);
}

export function normalizeSymptomKey(symptom: string): string {
  const key = symptom.trim().toLowerCase().replace(/\s+/g, "_");
  return SYMPTOM_COLORS[key] ? key : "custom";
}

export function topSymptoms(
  entries: CycleEntry[],
  days = 90,
  limit = 3,
  todayString = (() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  })()
): Array<{ symptom: string; count: number }> {
  const firstDay = addDaysUTC(todayString, -(Math.max(1, days) - 1));
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (entry.entry_date < firstDay || entry.entry_date > todayString) continue;
    for (const symptom of new Set(entry.symptoms ?? [])) {
      const key = normalizeSymptomKey(symptom);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts]
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom))
    .slice(0, Math.max(0, limit));
}
