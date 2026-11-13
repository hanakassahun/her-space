"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import TimeAgo from "@/components/TimeAgo";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import PostSkeleton from "@/components/ui/PostSkeleton";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import { getEnabledNotificationKinds, type NotificationKind } from "@/lib/notifPrefs";
import DecorativeEmptyArt from "@/components/DecorativeEmptyArt";

type NotificationRow = {
  id: string;
  actor_id: string | null;
  kind: NotificationKind;
  post_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
  message: string | null;
  metric: "helpful" | "likes" | null;
  amount: number | null;
  profiles: { id: string; display_name: string | null; avatar: string | null } | { id: string; display_name: string | null; avatar: string | null }[] | null;
  posts: { title: string; is_quick: boolean } | { title: string; is_quick: boolean }[] | null;
};

const PAGE_SIZE = 30;
const actionKeys = {
  comment: "notif.comment",
  follow: "notif.follow",
  repost: "notif.repost",
  quote: "notif.quote",
} as const;

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function notificationHref(notification: NotificationRow) {
  if (notification.kind === "follow" && notification.actor_id) {
    return `/u/${notification.actor_id}`;
  }
  if (notification.post_id) return `/post/${notification.post_id}`;
  return "/notifications";
}

function NotificationKindIcon({ kind }: { kind: NotificationKind }) {
  if (kind === "comment" || kind === "mention") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" />
      </svg>
    );
  }
  if (kind === "follow") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="9" cy="8" r="4" />
        <path d="M2.5 21a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M16 3h5v5M21 3l-8 8M8 8H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export default function NotificationsPage() {
  const {
    user,
    loading: authLoading,
    notificationPrefs,
    notificationsPausedUntil,
    setNotificationPreference,
    notificationPrefsSaving,
    notificationPrefsError,
  } = useAuth();
  const userId = user?.id ?? null;
  const { t } = useLanguage();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(0);
  const isPaused = Boolean(notificationsPausedUntil && (now === 0 || new Date(notificationsPausedUntil).getTime() > now));
  const enabledKinds = useMemo(
    () => isPaused ? ["review", "notice"] as NotificationKind[] : getEnabledNotificationKinds(notificationPrefs),
    [isPaused, notificationPrefs]
  );

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0);
    if (!notificationsPausedUntil) return () => window.clearTimeout(initialUpdate);
    const remaining = new Date(notificationsPausedUntil).getTime() - Date.now();
    const expirationUpdate = window.setTimeout(() => setNow(Date.now()), Math.max(0, remaining));
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearTimeout(expirationUpdate);
    };
  }, [notificationsPausedUntil]);

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    if (!userId) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("notifications")
      .select("id, actor_id, kind, post_id, comment_id, read_at, created_at, message, metric, amount, profiles!notifications_actor_id_fkey(id, display_name, avatar), posts!notifications_post_id_fkey(title, is_quick)")
      .eq("user_id", userId)
      .in("kind", enabledKinds)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      setMessage(friendlyError(error, t));
      if (append) setLoadingMore(false);
      else setLoading(false);
      return;
    }

    const rows = (data ?? []) as NotificationRow[];
    setNotifications((current) => {
      if (!append) return rows;
      const merged = new Map(current.map((row) => [row.id, row]));
      rows.forEach((row) => merged.set(row.id, row));
      return [...merged.values()];
    });
    setLoadedCount(offset + rows.length);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, [enabledKinds, t, userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const timeout = window.setTimeout(() => void loadPage(0, false), 0);
    return () => window.clearTimeout(timeout);
  }, [authLoading, loadPage, router, user, userId]);

  async function markRead(notification: NotificationRow, groupedRows: NotificationRow[] = [notification]) {
    if (!userId || groupedRows.every((row) => row.read_at)) return;
    const readAt = new Date().toISOString();
    const ids = groupedRows.map((row) => row.id);
    setNotifications((current) => current.map((row) => ids.includes(row.id) ? { ...row, read_at: readAt } : row));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", ids)
      .eq("user_id", userId);
    if (error) {
      const unreadIds = new Set(groupedRows.filter((row) => !row.read_at).map((row) => row.id));
      setNotifications((current) => current.map((row) => unreadIds.has(row.id) ? { ...row, read_at: null } : row));
      setMessage(friendlyError(error, t));
    } else {
      window.dispatchEvent(new Event("her-space:notifications-changed"));
    }
  }

  async function markAllRead() {
    if (!userId) return;
    const unread = notifications.filter((row) => enabledKinds.includes(row.kind) && !row.read_at);
    if (unread.length === 0) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((row) => !enabledKinds.includes(row.kind) || row.read_at ? row : { ...row, read_at: readAt }));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .in("kind", enabledKinds)
      .is("read_at", null);
    if (error) {
      const unreadIds = new Set(unread.map((row) => row.id));
      setNotifications((current) => current.map((row) => unreadIds.has(row.id) ? { ...row, read_at: null } : row));
      setMessage(friendlyError(error, t));
    } else {
      window.dispatchEvent(new Event("her-space:notifications-changed"));
    }
  }

  async function deleteNotification(notification: NotificationRow, groupedRows: NotificationRow[] = [notification]) {
    const ids = groupedRows.map((row) => row.id);
    if (!userId || ids.some((id) => deletingIds.includes(id))) return;
    const originalIndexes = groupedRows.map((row) => notifications.findIndex((item) => item.id === row.id));
    setDeletingIds((current) => [...current, ...ids]);
    setNotifications((current) => current.filter((row) => !ids.includes(row.id)));
    setLoadedCount((current) => Math.max(0, current - groupedRows.length));
    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", ids)
      .eq("user_id", userId);
    if (error) {
      setNotifications((current) => {
        const restored = [...current];
        groupedRows.forEach((row, index) => {
          if (!restored.some((item) => item.id === row.id)) {
            restored.splice(Math.min(originalIndexes[index], restored.length), 0, row);
          }
        });
        return restored;
      });
      setLoadedCount((current) => current + groupedRows.length);
      setMessage(friendlyError(error, t));
    } else {
      window.dispatchEvent(new Event("her-space:notifications-changed"));
    }
    setDeletingIds((current) => current.filter((id) => !ids.includes(id)));
  }

  const displayedNotifications = useMemo(() => {
    const cutoff = now === 0 ? Number.POSITIVE_INFINITY : now - 24 * 60 * 60 * 1000;
    const groups = new Map<string, NotificationRow[]>();
    const displayRows: { notification: NotificationRow; rows: NotificationRow[] }[] = [];
    for (const notification of notifications.filter((row) => enabledKinds.includes(row.kind))) {
      const canGroup = ["comment", "follow", "repost", "quote", "mention"].includes(notification.kind)
        || notification.kind === "series";
      const recent = new Date(notification.created_at).getTime() >= cutoff;
      const groupable = canGroup
        && recent
        && (notification.kind === "follow" || notification.kind === "series" ? Boolean(notification.actor_id) : Boolean(notification.post_id));
      if (!groupable) {
        displayRows.push({ notification, rows: [notification] });
        continue;
      }
      const target = notification.kind === "follow" ? "member"
        : notification.kind === "series" ? notification.actor_id
          : notification.kind === "mention" ? `${notification.post_id}:${notification.comment_id ?? "post"}` : notification.post_id;
      const key = `${notification.kind}:${target}`;
      const existing = groups.get(key);
      if (existing) existing.push(notification);
      else groups.set(key, [notification]);
    }
    for (const rows of groups.values()) {
      displayRows.push({ notification: rows[0], rows });
    }
    const order = new Map(notifications.map((row, index) => [row.id, index]));
    return displayRows.sort((a, b) => (order.get(a.notification.id) ?? 0) - (order.get(b.notification.id) ?? 0));
  }, [enabledKinds, notifications, now]);

  return (
    <PageShell className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="break-words text-3xl font-bold text-deep-plum">{t("notif.title")}</h1>
        {displayedNotifications.length > 0 && (
          <Button variant="secondary" type="button" onClick={() => void markAllRead()}>
            {t("notif.markAll")}
          </Button>
        )}
      </header>

      {message && <Card className="break-words text-red-700" role="alert"><FriendlyErrorMessage message={message} /></Card>}
      {notificationPrefsError && <Card className="break-words text-red-700" role="alert"><FriendlyErrorMessage message={notificationPrefsError} /></Card>}
      {isPaused && notificationsPausedUntil && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-100/80 px-4 py-3 text-sm text-gray-600">
          <p className="break-words">{t("notif.pausedUntil")} <time dateTime={notificationsPausedUntil}>{new Date(notificationsPausedUntil).toLocaleString()}</time></p>
          <Button variant="secondary" type="button" disabled={notificationPrefsSaving} onClick={() => void setNotificationPreference("notifications_paused_until", null)}>
            {t("notif.resume")}
          </Button>
        </div>
      )}
      {loading && <div className="space-y-3">{[0, 1, 2].map((index) => <PostSkeleton key={index} />)}</div>}
      {!loading && !message && displayedNotifications.length === 0 && !hasMore && (
        <Card className="space-y-4 text-center">
          <div className="flex justify-center"><DecorativeEmptyArt variant="moon" /></div>
          <p className="break-words leading-7 text-gray-700">{t("notif.empty")}</p>
          <Button type="button" onClick={() => router.push("/feed")}>{t("empty.browseFeed")}</Button>
        </Card>
      )}

      <section className="space-y-3" aria-label={t("notif.title")}>
        {displayedNotifications.map(({ notification, rows }) => {
          const actor = first(notification.profiles);
          const post = first(notification.posts);
          const actorName = actor?.display_name?.trim() || t("notif.unknown");
          const href = notificationHref(notification);
          const actors = [...new Map(rows
            .map((row) => first(row.profiles))
            .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
            .map((profile) => [profile.id, profile])).values()].slice(0, 3);
          const unread = rows.some((row) => !row.read_at);
          const content = (
            <>
              {actors.length > 0 && !["review", "notice"].includes(notification.kind) ? (
                <span className="mt-1 flex shrink-0 items-center pl-1" aria-hidden="true">
                  {actors.map((profile, index) => (
                    <span className={index === 0 ? "" : "-ml-2"} style={{ zIndex: actors.length - index }} key={profile.id}>
                      <Avatar name={profile.display_name || t("notif.unknown")} avatar={profile.avatar} size={32} />
                    </span>
                  ))}
                </span>
              ) : (
                <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-deep-plum" aria-hidden="true">
                  <NotificationKindIcon kind={notification.kind} />
                </span>
              )}
              <span className="min-w-0 flex-1 space-y-1">
                {notification.kind === "review" ? (
                  <>
                    <span className="block break-words font-medium text-deep-plum">{t("notif.review")}</span>
                    <span className="block break-words text-sm text-gray-600">{t("notif.reviewBody")}</span>
                  </>
                ) : notification.kind === "notice" ? (
                  <>
                    <span className="block break-words font-medium text-deep-plum">{t("notif.notice")}</span>
                    <span className="block whitespace-pre-wrap break-words text-sm text-gray-600">{notification.message ?? ""}</span>
                  </>
                ) : notification.kind === "milestone" ? (
                  <span className="block break-words font-medium text-deep-plum">
                    {notification.amount ?? 0} {t(notification.metric === "helpful" ? "notif.milestoneHelpful" : "notif.milestoneLikes")}
                  </span>
                ) : notification.kind === "series" ? (
                  <>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-medium text-deep-plum">{actorName}</span>
                      <span className="break-words text-sm text-gray-700">{rows.length > 1 ? `${t("notif.and")} ${rows.length - 1} ${t("notif.others")}` : t("notif.series")}</span>
                    </span>
                    <span className="block line-clamp-1 break-words text-sm text-gray-600">{post?.title || t("notif.postUnavailable")}</span>
                  </>
                ) : notification.kind === "mention" ? (
                  <>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-medium text-deep-plum">{actorName}</span>
                      {rows.length > 1 && <span className="break-words text-sm text-gray-700">{t("notif.and")} {rows.length - 1} {t("notif.others")}</span>}
                      <span className="break-words text-sm text-gray-700">{t(notification.comment_id ? "notif.mentionComment" : "notif.mentionPost")}</span>
                    </span>
                    <span className="block line-clamp-1 break-words text-sm text-gray-600">{post?.is_quick ? t("write.quickToggle") : post?.title || t("notif.postUnavailable")}</span>
                  </>
                ) : (
                  <>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-medium text-deep-plum">{actorName}</span>
                      {rows.length > 1 ? (
                        <span className="break-words text-sm text-gray-700">{t("notif.and")} {rows.length - 1} {t("notif.others")}</span>
                      ) : (
                        <span className="break-words text-sm text-gray-700">{t(actionKeys[notification.kind as keyof typeof actionKeys])}</span>
                      )}
                    </span>
                    {notification.kind !== "follow" && (
                      <span className="block line-clamp-1 break-words text-sm text-gray-600">
                        {post?.is_quick ? t("write.quickToggle") : post?.title || t("notif.postUnavailable")}
                      </span>
                    )}
                  </>
                )}
                <TimeAgo className="block text-xs text-gray-500" date={notification.created_at} />
              </span>
              {unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-periwinkle" aria-hidden="true" />}
            </>
          );
          return (
            <Card
              as="article"
              key={notification.id}
              className={`flex items-start gap-3 p-3 sm:p-4 ${unread ? "bg-soft-lilac/45" : ""}`}
            >
              {notification.kind === "notice" ? (
                <div className="flex min-h-11 min-w-0 flex-1 items-start gap-3">{content}</div>
              ) : (
                <Link
                  className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                  href={href}
                  onClick={() => void markRead(notification, rows)}
                >
                  {content}
                </Link>
              )}
              <button
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-white/70 hover:text-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                type="button"
                aria-label={t("notif.delete")}
                title={t("notif.delete")}
                disabled={rows.some((row) => deletingIds.includes(row.id))}
                onClick={() => void deleteNotification(notification, rows)}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />
                </svg>
              </button>
            </Card>
          );
        })}
      </section>

      {loadingMore && <div className="space-y-3">{[0, 1, 2].map((index) => <PostSkeleton key={index} />)}</div>}
      {!loading && hasMore && (
        <Button variant="secondary" className="w-full" type="button" disabled={loadingMore} onClick={() => void loadPage(loadedCount, true)}>
          {t("common.loadMore")}
        </Button>
      )}
    </PageShell>
  );
}
