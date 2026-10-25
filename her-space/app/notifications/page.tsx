"use client";

import { useCallback, useEffect, useState } from "react";
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

type NotificationKind = "comment" | "follow" | "repost" | "quote";
type NotificationRow = {
  id: string;
  actor_id: string | null;
  kind: NotificationKind;
  post_id: string | null;
  read_at: string | null;
  created_at: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
  posts: { title: string } | { title: string }[] | null;
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
  if (kind === "comment") {
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
  const { user, loading: authLoading } = useAuth();
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

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    if (!userId) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("notifications")
      .select("id, actor_id, kind, post_id, read_at, created_at, profiles!notifications_actor_id_fkey(display_name), posts!notifications_post_id_fkey(title)")
      .eq("user_id", userId)
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
  }, [t, userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    void loadPage(0, false);
  }, [authLoading, loadPage, router, userId]);

  async function markRead(notification: NotificationRow) {
    if (!userId || notification.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((row) => row.id === notification.id ? { ...row, read_at: readAt } : row));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notification.id)
      .eq("user_id", userId);
    if (error) {
      setNotifications((current) => current.map((row) => row.id === notification.id ? { ...row, read_at: null } : row));
      setMessage(friendlyError(error, t));
    } else {
      window.dispatchEvent(new Event("her-space:notifications-changed"));
    }
  }

  async function markAllRead() {
    if (!userId) return;
    const unread = notifications.filter((row) => !row.read_at);
    if (unread.length === 0) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((row) => row.read_at ? row : { ...row, read_at: readAt }));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      const unreadIds = new Set(unread.map((row) => row.id));
      setNotifications((current) => current.map((row) => unreadIds.has(row.id) ? { ...row, read_at: null } : row));
      setMessage(friendlyError(error, t));
    } else {
      window.dispatchEvent(new Event("her-space:notifications-changed"));
    }
  }

  async function deleteNotification(notification: NotificationRow) {
    if (!userId || deletingIds.includes(notification.id)) return;
    const originalIndex = notifications.findIndex((row) => row.id === notification.id);
    setDeletingIds((current) => [...current, notification.id]);
    setNotifications((current) => current.filter((row) => row.id !== notification.id));
    setLoadedCount((current) => Math.max(0, current - 1));
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notification.id)
      .eq("user_id", userId);
    if (error) {
      setNotifications((current) => {
        if (current.some((row) => row.id === notification.id)) return current;
        const restored = [...current];
        restored.splice(Math.min(originalIndex, restored.length), 0, notification);
        return restored;
      });
      setLoadedCount((current) => current + 1);
      setMessage(friendlyError(error, t));
    } else {
      window.dispatchEvent(new Event("her-space:notifications-changed"));
    }
    setDeletingIds((current) => current.filter((id) => id !== notification.id));
  }

  return (
    <PageShell className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="break-words text-3xl font-bold text-deep-plum">{t("notif.title")}</h1>
        {notifications.length > 0 && (
          <Button variant="secondary" type="button" onClick={() => void markAllRead()}>
            {t("notif.markAll")}
          </Button>
        )}
      </header>

      {message && <Card className="break-words text-red-700" role="alert"><FriendlyErrorMessage message={message} /></Card>}
      {loading && <div className="space-y-3">{[0, 1, 2].map((index) => <PostSkeleton key={index} />)}</div>}
      {!loading && !message && notifications.length === 0 && !hasMore && (
        <Card className="space-y-4 text-center">
          <p className="break-words leading-7 text-gray-700">{t("notif.empty")}</p>
          <Button type="button" onClick={() => router.push("/feed")}>{t("empty.browseFeed")}</Button>
        </Card>
      )}

      <section className="space-y-3" aria-label={t("notif.title")}>
        {notifications.map((notification) => {
          const actor = first(notification.profiles);
          const post = first(notification.posts);
          const actorName = actor?.display_name?.trim() || t("notif.unknown");
          const href = notificationHref(notification);
          return (
            <Card
              as="article"
              key={notification.id}
              className={`flex items-start gap-3 p-3 sm:p-4 ${notification.read_at ? "" : "bg-soft-lilac/45"}`}
            >
              <Link
                className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                href={href}
                onClick={() => void markRead(notification)}
              >
                <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-deep-plum" aria-hidden="true">
                  <NotificationKindIcon kind={notification.kind} />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-medium text-deep-plum">{actorName}</span>
                    <span className="break-words text-sm text-gray-700">{t(actionKeys[notification.kind])}</span>
                  </span>
                  {notification.kind !== "follow" && (
                    <span className="block line-clamp-1 break-words text-sm text-gray-600">
                      {post?.title || t("notif.postUnavailable")}
                    </span>
                  )}
                  <TimeAgo className="block text-xs text-gray-500" date={notification.created_at} />
                </span>
                {!notification.read_at && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-periwinkle" aria-hidden="true" />}
              </Link>
              <button
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-white/70 hover:text-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                type="button"
                aria-label={t("notif.delete")}
                title={t("notif.delete")}
                disabled={deletingIds.includes(notification.id)}
                onClick={() => void deleteNotification(notification)}
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
