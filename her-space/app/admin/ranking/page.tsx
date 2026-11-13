"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import type { TranslationKey } from "@/lib/i18n/en";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Variant = "A" | "B";
type RankingSettings = {
  w_interest: number;
  w_follow: number;
  w_series: number;
  w_engagement: number;
  w_trusted: number;
  w_fresh: number;
  fresh_hours: number;
  w_newcomer: number;
  decay_days: number;
  decay_power: number;
  author_decay: number;
  less_author: number;
  less_topic: number;
  explore_every: number;
};
type RankingRow = RankingSettings & { variant: Variant };
type ABStat = {
  variant: string;
  members: number;
  active_7d: number;
  avg_visit_days_7d: number;
  posts_per_active: number;
  comments_per_active: number;
};

const defaultSettings: RankingSettings = {
  w_interest: 3,
  w_follow: 4,
  w_series: 3,
  w_engagement: 1.5,
  w_trusted: 1,
  w_fresh: 1.5,
  fresh_hours: 12,
  w_newcomer: 1,
  decay_days: 4,
  decay_power: 1,
  author_decay: 0.6,
  less_author: 0.4,
  less_topic: 0.6,
  explore_every: 5,
};

const fields: {
  key: keyof RankingSettings;
  label: string;
  help: string;
  min: number;
  max: number;
  range: string;
  step: number;
}[] = [
  { key: "w_interest", label: "w_interest", help: "Boost for posts matching her interests.", min: 0, max: 10, range: "0 to 10", step: 0.1 },
  { key: "w_follow", label: "w_follow", help: "Boost for people she follows.", min: 0, max: 10, range: "0 to 10", step: 0.1 },
  { key: "w_series", label: "w_series", help: "Boost for series she follows.", min: 0, max: 10, range: "0 to 10", step: 0.1 },
  { key: "w_engagement", label: "w_engagement", help: "Log-scale weight of likes, saves, comments, shares, and helpful marks.", min: 0, max: 5, range: "0 to 5", step: 0.1 },
  { key: "w_trusted", label: "w_trusted", help: "Boost for evidence-backed or professional posts.", min: 0, max: 5, range: "0 to 5", step: 0.1 },
  { key: "w_fresh", label: "w_fresh", help: "Boost for brand-new posts.", min: 0, max: 5, range: "0 to 5", step: 0.1 },
  { key: "fresh_hours", label: "fresh_hours", help: "How long a post counts as brand-new.", min: 1, max: 72, range: "1 to 72", step: 1 },
  { key: "w_newcomer", label: "w_newcomer", help: "Boost for members with 3 or fewer posts.", min: 0, max: 5, range: "0 to 5", step: 0.1 },
  { key: "decay_days", label: "decay_days", help: "How fast posts age out.", min: 0.5, max: 60, range: "0.5 to 60", step: 0.1 },
  { key: "decay_power", label: "decay_power", help: "How sharply posts age out.", min: 0.5, max: 3, range: "0.5 to 3", step: 0.1 },
  { key: "author_decay", label: "author_decay", help: "Discount for a member's 2nd, 3rd, and later posts in one feed.", min: 0.1, max: 1, range: "0.1 to 1", step: 0.1 },
  { key: "less_author", label: "less_author", help: "Strength of “see fewer from this member.”", min: 0, max: 1, range: "0 to 1", step: 0.1 },
  { key: "less_topic", label: "less_topic", help: "Strength of “see fewer about this topic.”", min: 0, max: 1, range: "0 to 1", step: 0.1 },
  { key: "explore_every", label: "explore_every", help: "Every Nth slot is a discovery post; 0 turns discovery off.", min: 0, max: 20, range: "0 or 2 to 20", step: 1 },
];

const errorTranslations: Partial<Record<TranslationKey, string>> = {
  "errors.rateLimit": "Please wait a moment and try again.",
  "errors.network": "Check your connection and try again.",
  "errors.sessionExpired": "Your session expired. Please sign in again.",
  "errors.generic": "Something went wrong. Please try again.",
};
const translateError = (key: TranslationKey) => errorTranslations[key] ?? "Something went wrong. Please try again.";
const emptyStats: ABStat[] = [];

function validSettings(values: RankingSettings): boolean {
  return fields.every(({ key, min, max }) => {
    const value = values[key];
    return Number.isFinite(value)
      && value >= min
      && value <= max
      && (key !== "explore_every" || value === 0 || value >= 2);
  });
}

export default function AdminRankingPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<Variant, RankingSettings>>({
    A: { ...defaultSettings },
    B: { ...defaultSettings },
  });
  const [bPercent, setBPercent] = useState(0);
  const [stats, setStats] = useState<ABStat[]>(emptyStats);
  const [savingVariant, setSavingVariant] = useState<Variant | null>(null);
  const [savingExperiment, setSavingExperiment] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadRankingSettings() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (!active) return;
      if (adminError || !admin) {
        router.replace("/");
        return;
      }
      setAuthorized(true);

      const [settingsResult, experimentResult, statsResult] = await Promise.all([
        supabase.from("ranking_settings").select("*"),
        supabase.from("ranking_ab").select("b_percent").eq("id", 1).maybeSingle(),
        supabase.rpc("admin_ab_stats"),
      ]);
      if (!active) return;

      if (settingsResult.error) setMessage(friendlyError(settingsResult.error, translateError));
      else {
        const nextSettings = { A: { ...defaultSettings }, B: { ...defaultSettings } };
        for (const row of (settingsResult.data ?? []) as RankingRow[]) {
          if (row.variant === "A" || row.variant === "B") {
            const { variant, ...values } = row;
            nextSettings[variant] = { ...defaultSettings, ...values };
          }
        }
        setSettings(nextSettings);
      }
      if (experimentResult.error) setMessage(friendlyError(experimentResult.error, translateError));
      else setBPercent(experimentResult.data?.b_percent ?? 0);
      if (statsResult.error) setMessage(friendlyError(statsResult.error, translateError));
      else setStats((statsResult.data ?? []) as ABStat[]);
      setLoading(false);
    }

    void loadRankingSettings();
    return () => { active = false; };
  }, [router]);

  async function saveVariant(variant: Variant, values: RankingSettings) {
    if (savingVariant) return;
    if (!validSettings(values)) {
      setMessage(`Variant ${variant} has an invalid value. explore_every must be 0 or between 2 and 20.`);
      return;
    }

    setSavingVariant(variant);
    setMessage("");
    const { error } = await supabase
      .from("ranking_settings")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("variant", variant);
    if (error) setMessage(friendlyError(error, translateError));
    else {
      setSettings((current) => ({ ...current, [variant]: { ...values } }));
      setMessage(`Variant ${variant} saved.`);
    }
    setSavingVariant(null);
  }

  async function saveDefaults(variant: Variant) {
    await saveVariant(variant, { ...defaultSettings });
  }

  async function saveBPercent() {
    if (savingExperiment) return;
    setSavingExperiment(true);
    setMessage("");
    const { error } = await supabase
      .from("ranking_ab")
      .update({ b_percent: bPercent })
      .eq("id", 1);
    if (error) setMessage(friendlyError(error, translateError));
    else setMessage("Experiment allocation saved.");
    setSavingExperiment(false);
  }

  if (!authorized) {
    return <PageShell className="max-w-5xl"><p className="sr-only">Checking administrator access…</p></PageShell>;
  }

  return (
    <PageShell className="max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-deep-plum">Feed ranking</h1>
        <Link className="inline-flex min-h-11 items-center rounded-full border border-soft-lilac bg-white px-4 text-sm font-semibold text-deep-plum underline" href="/admin">
          Back to admin
        </Link>
      </header>

      {message && <Card className="break-words whitespace-pre-line text-sm text-deep-plum" role="status">{message}</Card>}
      {loading ? <p className="text-gray-700">Loading ranking settings…</p> : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["A", "B"] as const).map((variant) => (
              <Card key={variant} className="space-y-4">
                <h2 className="text-xl font-semibold text-deep-plum">Variant {variant}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => (
                    <label className="block min-w-0 space-y-1.5" key={field.key}>
                      <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-semibold text-deep-plum">
                        <span>{field.label}</span>
                        <span className="text-xs font-normal text-gray-600">Range: {field.range}</span>
                      </span>
                      <input
                        className="min-h-11 w-full rounded-xl border border-[#CDBDEB] bg-white px-3 py-2 text-deep-plum focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8]"
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={settings[variant][field.key]}
                        aria-label={`Variant ${variant} ${field.label}`}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          setSettings((current) => ({
                            ...current,
                            [variant]: {
                              ...current[variant],
                              [field.key]: Number.isNaN(value) ? 0 : value,
                            },
                          }));
                        }}
                      />
                      <span className="block min-h-5 break-words text-xs leading-5 text-gray-600">{field.help}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 border-t border-soft-lilac/70 pt-4">
                  <Button type="button" disabled={savingVariant !== null} onClick={() => void saveVariant(variant, settings[variant])}>
                    {savingVariant === variant ? "Saving…" : "Save variant"}
                  </Button>
                  <Button variant="secondary" type="button" disabled={savingVariant !== null} onClick={() => void saveDefaults(variant)}>
                    Reset to defaults
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="space-y-4">
            <h2 className="text-xl font-semibold text-deep-plum">A/B experiment</h2>
            <label className="block space-y-2">
              <span className="flex flex-wrap justify-between gap-2 text-sm font-semibold text-deep-plum">
                <span>Variant B allocation</span>
                <span>{bPercent}%</span>
              </span>
              <input
                className="min-h-11 w-full accent-[#8F72BE]"
                type="range"
                min={0}
                max={50}
                step={1}
                value={bPercent}
                aria-label="Variant B allocation percentage"
                onChange={(event) => setBPercent(event.currentTarget.valueAsNumber)}
              />
            </label>
            <p className="break-words text-sm leading-6 text-amber-900">
              Members are split by a stable hash. Changing this changes who sees variant B at once. Compare for at least 2 weeks and 100+ members; small groups are noise.
            </p>
            <Button type="button" disabled={savingExperiment} onClick={() => void saveBPercent()}>
              {savingExperiment ? "Saving…" : "Save allocation"}
            </Button>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-soft-lilac text-deep-plum">
                    <th className="px-3 py-2 font-semibold">Variant</th>
                    <th className="px-3 py-2 font-semibold">Members</th>
                    <th className="px-3 py-2 font-semibold">Active (7d)</th>
                    <th className="px-3 py-2 font-semibold">Avg visit days (7d)</th>
                    <th className="px-3 py-2 font-semibold">Posts / active</th>
                    <th className="px-3 py-2 font-semibold">Comments / active</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((row) => (
                    <tr className="border-b border-soft-lilac/70" key={row.variant}>
                      <td className="px-3 py-2">{row.variant}</td>
                      <td className="px-3 py-2">{row.members}</td>
                      <td className="px-3 py-2">{row.active_7d}</td>
                      <td className="px-3 py-2">{Number(row.avg_visit_days_7d).toFixed(2)}</td>
                      <td className="px-3 py-2">{Number(row.posts_per_active).toFixed(2)}</td>
                      <td className="px-3 py-2">{Number(row.comments_per_active).toFixed(2)}</td>
                    </tr>
                  ))}
                  {stats.length === 0 && (
                    <tr><td className="px-3 py-3 text-gray-600" colSpan={6}>No experiment stats available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="break-words text-sm leading-6 text-gray-700">Counts only. No one&apos;s reading or journal data is used.</p>
          </Card>
        </>
      )}
    </PageShell>
  );
}
