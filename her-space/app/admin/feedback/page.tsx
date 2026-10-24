"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

type FeedbackStatus = "new" | "seen" | "done";
type FeedbackKind = "bug" | "confusing" | "idea" | "other";

type FeedbackRow = {
  id: string;
  kind: FeedbackKind;
  message: string;
  page: string | null;
  status: FeedbackStatus;
  created_at: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

type Related<T> = T | T[] | null;

function first<T>(related: Related<T>): T | null {
  return Array.isArray(related) ? (related[0] ?? null) : related;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Broken",
  confusing: "Confusing",
  idea: "Idea",
  other: "Other",
};

const KIND_VARIANTS: Record<FeedbackKind, "rose" | "sky" | "mint" | "lilac"> = {
  bug: "rose",
  confusing: "sky",
  idea: "mint",
  other: "lilac",
};

const STATUS_FILTERS: { value: FeedbackStatus | "all"; label: string }[] = [
  { value: "new", label: "New" },
  { value: "seen", label: "Seen" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("new");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.replace("/"); return; }

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (adminError || !admin) { router.replace("/"); return; }

      const query = supabase
        .from("feedback")
        .select("id, kind, message, page, status, created_at, profiles!feedback_user_id_fkey(display_name)")
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) { setMessage(error.message); } else { setRows((data ?? []) as FeedbackRow[]); }
      setLoading(false);
    }
    void load();
  }, [router]);

  async function setStatus(id: string, status: FeedbackStatus) {
    if (busyId) return;
    setBusyId(id);
    const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
    if (error) {
      setMessage(error.message);
    } else {
      setRows((current) => current.map((r) => r.id === id ? { ...r, status } : r));
    }
    setBusyId(null);
  }

  const visible = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);

  return (
    <PageShell className="max-w-4xl space-y-8 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-4">
        <h1 className="mt-3 text-3xl font-bold text-deep-plum">Member feedback</h1>
        <nav className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              className={[
                "min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition border",
                statusFilter === value
                  ? "gradient-aurora border-transparent text-white"
                  : "border-[#CDBDEB] bg-white text-deep-plum hover:bg-soft-lilac/20",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {loading && <p className="text-gray-700">Loading feedback...</p>}
      {message && <Card className="text-red-700">{message}</Card>}
      {!loading && visible.length === 0 && (
        <Card className="text-gray-700">No feedback in this category.</Card>
      )}

      <section className="space-y-4" aria-label="Feedback list">
        {visible.map((row) => {
          const author = first(row.profiles);
          return (
            <Card as="article" key={row.id} className="space-y-3">
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={KIND_VARIANTS[row.kind]}>{KIND_LABELS[row.kind]}</Badge>
                  <span className="text-sm font-medium text-gray-900">
                    {author?.display_name ?? "Her Space member"}
                  </span>
                  {row.page && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
                      {row.page}
                    </span>
                  )}
                </div>
                <time className="text-xs text-gray-500" dateTime={row.created_at}>
                  {formatDate(row.created_at)}
                </time>
              </div>

              {/* Message */}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {row.message}
              </p>

              {/* Status buttons */}
              <div className="flex flex-wrap items-center gap-2 border-t border-rose-100 pt-3">
                <span className="text-xs text-gray-500">Status:</span>
                {(["new", "seen", "done"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={row.status === s ? "primary" : "secondary"}
                    className="text-xs"
                    disabled={busyId === row.id || row.status === s}
                    onClick={() => void setStatus(row.id, s)}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
            </Card>
          );
        })}
      </section>
    </PageShell>
  );
}
