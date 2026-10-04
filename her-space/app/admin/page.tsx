"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Related<T> = T | T[] | null;

type Report = {
  id: string;
  reporter_id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  created_at: string;
  profiles: Related<{ display_name: string | null }>;
  posts: Related<{ title: string; body: string }>;
  comments: Related<{ body: string }>;
};

function first<T>(related: Related<T>) {
  return Array.isArray(related) ? related[0] : related;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadReports() {
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

      if (adminError || !admin) {
        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .from("reports")
        .select(
          "id, reporter_id, post_id, comment_id, reason, created_at, profiles!reports_reporter_id_fkey(display_name), posts!reports_post_id_fkey(title, body), comments!reports_comment_id_fkey(body)"
        )
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        setReports((data ?? []) as Report[]);
      }
      setLoading(false);
    }

    void loadReports();
  }, [router]);

  async function markResolved(reportId: string) {
    setBusyReportId(reportId);
    setMessage("");
    const { error } = await supabase
      .from("reports")
      .update({ status: "resolved" })
      .eq("id", reportId);

    if (error) {
      setMessage(error.message);
    } else {
      setReports((current) => current.filter((report) => report.id !== reportId));
    }
    setBusyReportId(null);
  }

  async function deleteReportedContent(report: Report) {
    setBusyReportId(report.id);
    setMessage("");

    // Resolve first because the report's target foreign keys cascade on content deletion.
    const { error: resolveError } = await supabase
      .from("reports")
      .update({ status: "resolved" })
      .eq("id", report.id);

    if (resolveError) {
      setMessage(resolveError.message);
      setBusyReportId(null);
      return;
    }

    const deleteResult = report.comment_id
      ? await supabase.from("comments").delete().eq("id", report.comment_id)
      : report.post_id
        ? await supabase.from("posts").delete().eq("id", report.post_id)
        : { error: new Error("This report has no content to delete.") };

    if (deleteResult.error) {
      await supabase.from("reports").update({ status: "open" }).eq("id", report.id);
      setMessage(deleteResult.error.message);
    } else {
      setReports((current) => current.filter((item) => item.id !== report.id));
    }
    setBusyReportId(null);
  }

  return (
    <main className="min-h-screen bg-rose-50 px-6 py-12">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header>
          <Link className="text-sm text-rose-800 underline" href="/">
            Back home
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-rose-900">Admin reports</h1>
        </header>

        {loading && <p className="text-gray-700">Loading reports...</p>}
        {message && <p className="rounded bg-white p-4 text-red-600">{message}</p>}
        {!loading && !message && reports.length === 0 && (
          <p className="rounded bg-white p-6 text-gray-700">No open reports.</p>
        )}

        <section className="space-y-4" aria-label="Open reports">
          {reports.map((report) => {
            const post = first(report.posts);
            const comment = first(report.comments);
            const reporter = first(report.profiles);

            return (
              <article key={report.id} className="space-y-4 rounded bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-gray-600">
                    Reported by {reporter?.display_name || "Her Space member"}
                  </p>
                  <time className="text-sm text-gray-500" dateTime={report.created_at}>
                    {formatDate(report.created_at)}
                  </time>
                </div>

                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-rose-900">Reason</h2>
                  <p className="whitespace-pre-wrap text-gray-900">{report.reason}</p>
                </div>

                {post && (
                  <div className="space-y-1 rounded bg-rose-50 p-4">
                    <h3 className="font-semibold text-gray-900">Reported post: {post.title}</h3>
                    <p className="whitespace-pre-wrap text-gray-800">{post.body}</p>
                  </div>
                )}

                {comment && (
                  <div className="space-y-1 rounded bg-rose-50 p-4">
                    <h3 className="font-semibold text-gray-900">Reported comment</h3>
                    <p className="whitespace-pre-wrap text-gray-800">{comment.body}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 border-t border-rose-100 pt-4">
                  <button
                    className="rounded bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    type="button"
                    onClick={() => markResolved(report.id)}
                    disabled={busyReportId === report.id}
                  >
                    Mark resolved
                  </button>
                  <button
                    className="rounded border border-rose-700 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-50"
                    type="button"
                    onClick={() => deleteReportedContent(report)}
                    disabled={busyReportId === report.id}
                  >
                    Delete content
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}