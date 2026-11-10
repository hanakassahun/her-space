"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Avatar from "@/components/Avatar";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import SeriesFollowButton from "@/components/SeriesFollowButton";

type Opener = {
  id: string;
  title: string;
  author_id: string;
  series_cadence: "daily" | "weekly" | "monthly" | "whenever" | null;
  series_status: "active" | "paused" | "finished" | null;
  profiles: { display_name: string | null; avatar: string | null } | { display_name: string | null; avatar: string | null }[] | null;
};
type Follow = { root_post_id: string };
const first = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value;
const cadenceKey = { daily: "series.daily", weekly: "series.weekly", monthly: "series.monthly", whenever: "series.whenever" } as const;
const statusKey = { active: "series.active", paused: "series.paused", finished: "series.finished" } as const;

export default function SeriesIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [followed, setFollowed] = useState<Opener[]>([]);
  const [discover, setDiscover] = useState<Opener[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let active = true;
    void (async () => {
      const { data: follows, error: followsError } = await supabase.from("series_follows").select("root_post_id").eq("user_id", user.id);
      if (followsError) {
        setMessage(friendlyError(followsError, t));
        setLoading(false);
        return;
      }
      const ids = [...new Set(((follows ?? []) as Follow[]).map((row) => row.root_post_id))];
      const [followedResult, discoverResult] = await Promise.all([
        ids.length ? supabase.from("posts").select("id, title, author_id, is_series_opener, series_root_id, series_position, series_cadence, series_status, profiles!posts_author_id_fkey(display_name, avatar)").in("id", ids).eq("is_series_opener", true) : Promise.resolve({ data: [], error: null }),
        supabase.from("posts").select("id, title, author_id, is_series_opener, series_root_id, series_position, series_cadence, series_status, profiles!posts_author_id_fkey(display_name, avatar)").eq("is_series_opener", true).order("created_at", { ascending: false }).limit(20),
      ]);
      if (!active) return;
      const queryError = followedResult.error ?? discoverResult.error;
      if (queryError) setMessage(friendlyError(queryError, t));
      const followedRows = (followedResult.data ?? []) as Opener[];
      const discoverRows = (discoverResult.data ?? []) as Opener[];
      setFollowed(followedRows);
      setDiscover(discoverRows);
      const allIds = [...new Set([...followedRows, ...discoverRows].map((row) => row.id))];
      if (allIds.length) {
        const { data: partRows, error: countError } = await supabase.from("posts").select("series_root_id").in("series_root_id", allIds);
        if (!active) return;
        if (countError) setMessage(friendlyError(countError, t));
        else {
          const nextCounts: Record<string, number> = Object.fromEntries(allIds.map((id) => [id, 1]));
          for (const row of partRows ?? []) nextCounts[row.series_root_id] = (nextCounts[row.series_root_id] ?? 1) + 1;
          setCounts(nextCounts);
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [authLoading, router, t, user]);

  function renderSeries(series: Opener[]) {
    if (!series.length) return <Card className="text-gray-700">{t("series.empty")}</Card>;
    return <div className="space-y-3">{series.map((item) => {
      const profile = first(item.profiles);
      return <Card as="article" key={item.id} className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={profile?.display_name || t("notif.unknown")} avatar={profile?.avatar ?? null} size={40} />
          <Link className="text-sm text-deep-plum underline" href={`/u/${item.author_id}`}>{profile?.display_name || t("notif.unknown")}</Link>
          <Badge variant="lilac">{t(statusKey[item.series_status ?? "active"])}</Badge>
          <Badge variant="lilac">{t(cadenceKey[item.series_cadence ?? "weekly"])}</Badge>
        </div>
        <Link className="block break-words text-lg font-semibold text-deep-plum underline" href={`/series/${item.id}`}>{item.title}</Link>
        <p className="text-sm text-gray-600">{counts[item.id] ?? 1} {t("series.part")}</p>
        <SeriesFollowButton rootId={item.id} authorId={item.author_id} />
      </Card>;
    })}</div>;
  }

  return <PageShell className="max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
    <h1 className="text-3xl font-bold text-deep-plum">{t("series.discover")}</h1>
    {message && <Card className="break-words text-red-700" role="alert">{message}</Card>}
    {loading ? <p className="text-gray-700">{t("common.loading")}</p> : <>
      <section className="space-y-3"><h2 className="text-xl font-semibold text-deep-plum">{t("series.following.title")}</h2>{renderSeries(followed)}</section>
      <section className="space-y-3"><h2 className="text-xl font-semibold text-deep-plum">{t("series.discover")}</h2>{renderSeries(discover)}</section>
    </>}
  </PageShell>;
}
