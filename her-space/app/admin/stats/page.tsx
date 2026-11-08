"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";

type AdminStats = {
  members_total: number;
  joined_7d: number;
  joined_30d: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  readers_only_7d: number;
  d1_returned: number;
  d1_cohort: number;
  d7_returned: number;
  d7_cohort: number;
  posts_7d: number;
  comments_7d: number;
  open_invite_requests: number;
};

const emptyStats: AdminStats = {
  members_total: 0, joined_7d: 0, joined_30d: 0, active_today: 0, active_7d: 0, active_30d: 0,
  readers_only_7d: 0, d1_returned: 0, d1_cohort: 0, d7_returned: 0, d7_cohort: 0,
  posts_7d: 0, comments_7d: 0, open_invite_requests: 0,
};

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function StatBar({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = percentage(value, total);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-between gap-2 text-sm text-gray-700">
        <span className="break-words">{label}</span>
        <span>{value} ({percent}%)</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-soft-lilac/60" aria-hidden="true">
        <div className="h-full rounded-full bg-periwinkle" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function AdminStatsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<AdminStats>(emptyStats);

  useEffect(() => {
    let active = true;
    async function loadStats() {
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
      const { data, error } = await supabase.rpc("admin_stats");
      if (!active) return;
      if (error) setMessage(error.message);
      else {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setStats({ ...emptyStats, ...row } as AdminStats);
      }
      setLoading(false);
    }
    void loadStats();
    return () => { active = false; };
  }, [router]);

  if (!authorized) return <PageShell className="max-w-4xl"><p className="sr-only">Checking administrator access…</p></PageShell>;

  return (
    <PageShell className="max-w-5xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-deep-plum">Demand dashboard</h1>
        <Link className="inline-flex min-h-11 items-center rounded-full border border-soft-lilac bg-white px-4 text-sm font-semibold text-deep-plum underline" href="/admin">Back to admin</Link>
      </header>
      {message && <Card className="break-words text-red-700" role="alert">{message}</Card>}
      {loading ? <p className="text-gray-700">Loading dashboard…</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-deep-plum">Members</h2>
            <p className="text-3xl font-bold text-deep-plum">{stats.members_total}</p>
            <StatBar label="Joined in 7 days" value={stats.joined_7d} total={stats.members_total} />
            <StatBar label="Joined in 30 days" value={stats.joined_30d} total={stats.members_total} />
          </Card>
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-deep-plum">Active members</h2>
            <StatBar label="Today" value={stats.active_today} total={stats.members_total} />
            <StatBar label="Last 7 days" value={stats.active_7d} total={stats.members_total} />
            <StatBar label="Last 30 days" value={stats.active_30d} total={stats.members_total} />
          </Card>
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-deep-plum">Readers who did not post or comment (7 days)</h2>
            <p className="text-3xl font-bold text-deep-plum">{stats.readers_only_7d}</p>
            <StatBar label="Of active members" value={stats.readers_only_7d} total={stats.active_7d} />
          </Card>
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-deep-plum">Return visits</h2>
            <StatBar label={`Day 1 (${stats.d1_returned} of ${stats.d1_cohort})`} value={stats.d1_returned} total={stats.d1_cohort} />
            <StatBar label={`Day 7 (${stats.d7_returned} of ${stats.d7_cohort})`} value={stats.d7_returned} total={stats.d7_cohort} />
            <p className="text-sm text-gray-600">Small numbers are not reliable.</p>
          </Card>
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-deep-plum">Community activity (7 days)</h2>
            <StatBar label="Posts" value={stats.posts_7d} total={Math.max(stats.posts_7d, stats.comments_7d, 1)} />
            <StatBar label="Comments" value={stats.comments_7d} total={Math.max(stats.posts_7d, stats.comments_7d, 1)} />
          </Card>
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-deep-plum">Open invite requests</h2>
            <p className="text-3xl font-bold text-deep-plum">{stats.open_invite_requests}</p>
            <Link className="inline-flex min-h-11 items-center font-semibold text-deep-plum underline" href="/admin/invite-requests">Review requests</Link>
          </Card>
        </div>
      )}
      <p className="break-words text-sm leading-6 text-gray-700">Counts only. No one&apos;s reading or journal data is used.</p>
    </PageShell>
  );
}
