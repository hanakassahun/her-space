"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import SeriesFollowButton from "@/components/SeriesFollowButton";

type SeriesPart = {
  id: string;
  title: string;
  series_position: number;
  author_id: string;
  is_series_opener: boolean;
  series_cadence: "daily" | "weekly" | "monthly" | "whenever" | null;
  series_status: "active" | "paused" | "finished" | null;
  created_at: string;
};

const statusKey = {
  active: "series.active", paused: "series.paused", finished: "series.finished",
} as const;

export default function SeriesBox({
  postId,
  authorId,
  isOpener,
  rootPostId,
  position,
}: {
  postId: string;
  authorId: string;
  isOpener: boolean;
  rootPostId: string | null;
  position: number | null;
}) {
  const rootId = isOpener ? postId : rootPostId;
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [parts, setParts] = useState<SeriesPart[]>([]);
  const [loadedRootId, setLoadedRootId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!rootId) return;
    let active = true;
    void supabase.from("posts")
      .select("id, title, series_position, author_id, is_series_opener, series_cadence, series_status, created_at")
      .or(`id.eq.${rootId},series_root_id.eq.${rootId}`)
      .order("series_position", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(friendlyError(error, t));
        else setParts((data ?? []) as SeriesPart[]);
        setLoadedRootId(rootId);
      });
    return () => { active = false; };
  }, [rootId, t]);

  const opener = parts.find((part) => part.id === rootId && part.is_series_opener);
  if (!rootId) return null;
  if (loadedRootId !== rootId) return null;
  if (!opener) return <p className="text-sm text-gray-500">{t("series.part")} {position ?? 1} · {t("series.unavailable")}</p>;
  const currentIndex = parts.findIndex((part) => part.id === postId);
  const current = parts[currentIndex];
  const isAuthor = user?.id === authorId;

  async function updateOpener(field: "series_status" | "series_cadence", value: string) {
    const old = parts;
    setParts((rows) => rows.map((row) => row.id === rootId ? { ...row, [field]: value } : row));
    const { error } = await supabase.from("posts").update({ [field]: value }).eq("id", rootId);
    if (error) {
      setParts(old);
      setMessage(friendlyError(error, t));
    }
  }

  return (
    <Card className="space-y-3 border border-soft-lilac/70 bg-soft-lilac/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/series/${rootId}`} className="font-semibold text-deep-plum underline">{opener.title}</Link>
        <Badge variant="lilac">{t(statusKey[opener.series_status ?? "active"])}</Badge>
      </div>
      <p className="text-sm text-gray-700">{t("series.part")} {current?.series_position ?? position ?? 1} {t("series.of")} {parts.length}</p>
      <div className="flex flex-wrap gap-2">
        {currentIndex > 0 && <Button variant="secondary" type="button" onClick={() => router.push(`/post/${parts[currentIndex - 1].id}`)}>{t("series.prev")}</Button>}
        {currentIndex >= 0 && currentIndex < parts.length - 1 && <Button variant="secondary" type="button" onClick={() => router.push(`/post/${parts[currentIndex + 1].id}`)}>{t("series.next")}</Button>}
        <Link className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-deep-plum underline" href={`/series/${rootId}`}>{t("series.allParts")}</Link>
        {isAuthor ? <Link className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-deep-plum underline" href={`/new?series=${rootId}`}>{t("series.writeNext")}</Link> : <SeriesFollowButton rootId={rootId} authorId={authorId} />}
      </div>
      {isAuthor && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-deep-plum">{t("series.active")}
            <select className="min-h-11 w-full rounded-xl border border-[#CDBDEB] bg-white px-3" value={opener.series_status ?? "active"} onChange={(event) => void updateOpener("series_status", event.target.value)}>
              <option value="active">{t("series.active")}</option><option value="paused">{t("series.paused")}</option><option value="finished">{t("series.finished")}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-deep-plum">{t("series.cadence")}
            <select className="min-h-11 w-full rounded-xl border border-[#CDBDEB] bg-white px-3" value={opener.series_cadence ?? "weekly"} onChange={(event) => void updateOpener("series_cadence", event.target.value)}>
              <option value="daily">{t("series.daily")}</option><option value="weekly">{t("series.weekly")}</option><option value="monthly">{t("series.monthly")}</option><option value="whenever">{t("series.whenever")}</option>
            </select>
          </label>
        </div>
      )}
      {message && <p className="break-words text-sm text-red-700" role="alert">{message}</p>}
    </Card>
  );
}
