"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Avatar from "@/components/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import SeriesFollowButton from "@/components/SeriesFollowButton";

type Part = {
  id: string;
  title: string;
  body: string;
  series_position: number;
  author_id: string;
  is_series_opener: boolean;
  series_cadence: "daily" | "weekly" | "monthly" | "whenever" | null;
  series_status: "active" | "paused" | "finished" | null;
  created_at: string;
  profiles: { display_name: string | null; avatar: string | null } | { display_name: string | null; avatar: string | null }[] | null;
};
const first = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value;
const cadenceKey = { daily: "series.daily", weekly: "series.weekly", monthly: "series.monthly", whenever: "series.whenever" } as const;
const statusKey = { active: "series.active", paused: "series.paused", finished: "series.finished" } as const;

export default function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useLanguage();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let active = true;
    void supabase.from("posts")
      .select("id, title, body, series_root_id, series_position, author_id, is_series_opener, series_cadence, series_status, created_at, profiles!posts_author_id_fkey(display_name, avatar)")
      .or(`id.eq.${id},series_root_id.eq.${id}`)
      .order("series_position", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(friendlyError(error, t));
        else setParts((data ?? []) as Part[]);
        setLoading(false);
      });
    return () => { active = false; };
  }, [authLoading, id, router, t, user]);

  const opener = parts.find((part) => part.id === id && part.is_series_opener);
  const author = first(opener?.profiles ?? null);
  const dateLocale = lang === "am" ? "am-ET" : "en-US";
  return (
    <PageShell className="max-w-3xl space-y-5 px-4 py-6 md:px-6 md:py-10">
      {loading && <p className="text-gray-700">{t("common.loading")}</p>}
      {!loading && !opener && <Card className="text-gray-700">{t("series.unavailable")}</Card>}
      {message && <Card className="break-words text-red-700" role="alert">{message}</Card>}
      {opener && (
        <>
          <Card className="space-y-4">
            <h1 className="break-words text-3xl font-bold text-deep-plum">{opener.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={author?.display_name || t("notif.unknown")} avatar={author?.avatar ?? null} size={44} />
              <Link className="text-deep-plum underline" href={`/u/${opener.author_id}`}>{author?.display_name || t("notif.unknown")}</Link>
              <Badge variant="lilac">{t(statusKey[opener.series_status ?? "active"])}</Badge>
              <Badge variant="lilac">{t(cadenceKey[opener.series_cadence ?? "weekly"])}</Badge>
              <SeriesFollowButton rootId={id} authorId={opener.author_id} />
            </div>
            <p className="whitespace-pre-wrap break-words text-gray-700">{opener.body.slice(0, 200)}</p>
            {user?.id === opener.author_id && <Link className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold text-deep-plum underline" href={`/new?series=${id}`}>{t("series.writeNext")}</Link>}
          </Card>
          <section className="space-y-3" aria-label={t("series.allParts")}>
            {parts.map((part) => (
              <Link key={part.id} className="block" href={`/post/${part.id}`}>
                <Card as="article" className="space-y-2 transition-colors hover:bg-white/80">
                  <h2 className="break-words font-semibold text-deep-plum">{t("series.part")} {part.series_position}</h2>
                  <p className="break-words font-medium text-gray-900">{part.title}</p>
                  <p className="break-words text-sm text-gray-700">{part.body.slice(0, 160)}</p>
                  <time className="block text-xs text-gray-500" dateTime={part.created_at}>{new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium" }).format(new Date(part.created_at))}</time>
                </Card>
              </Link>
            ))}
          </section>
          <Button type="button" variant="secondary" onClick={() => router.push(`/post/${opener.id}`)}>{t("series.startFromOne")}</Button>
        </>
      )}
    </PageShell>
  );
}
