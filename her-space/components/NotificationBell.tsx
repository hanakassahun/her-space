"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import NavIcon from "@/components/NavIcon";
import { supabase } from "@/lib/supabase";
import { getEnabledNotificationKinds } from "@/lib/notifPrefs";

export default function NotificationBell() {
  const { user, notificationPrefs, notificationsPausedUntil } = useAuth();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadCountUserId, setUnreadCountUserId] = useState<string | null>(null);
  const [unreadCountKinds, setUnreadCountKinds] = useState("");
  const [now, setNow] = useState(0);
  const isPaused = Boolean(notificationsPausedUntil && (now === 0 || new Date(notificationsPausedUntil).getTime() > now));
  const enabledKinds = useMemo(() => getEnabledNotificationKinds(notificationPrefs), [notificationPrefs]);
  const enabledKindsKey = enabledKinds.join(",");

  const refreshCount = useCallback(async () => {
    if (!user) return;
    if (isPaused) {
      setUnreadCount(0);
      return;
    }
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("kind", enabledKinds)
      .is("read_at", null);
    if (!error) {
      setUnreadCount(count ?? 0);
      setUnreadCountUserId(user.id);
      setUnreadCountKinds(enabledKindsKey);
    }
  }, [enabledKinds, enabledKindsKey, isPaused, user]);

  useEffect(() => {
    if (!notificationsPausedUntil) return;
    const remaining = new Date(notificationsPausedUntil).getTime() - Date.now();
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(0, remaining));
    return () => window.clearTimeout(timeout);
  }, [notificationsPausedUntil]);

  useEffect(() => {
    if (!user) return;
    const initialRefresh = window.setTimeout(() => void refreshCount(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCount();
    }, 90000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshCount();
    };
    const handleNotificationsChanged = () => void refreshCount();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("her-space:notifications-changed", handleNotificationsChanged);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("her-space:notifications-changed", handleNotificationsChanged);
    };
  }, [refreshCount, user]);

  if (!user) return null;

  const badgeCount = unreadCountUserId === user.id && unreadCountKinds === enabledKindsKey && !isPaused ? unreadCount : 0;
  const label = badgeCount > 0 ? `${t("notif.title")} (${badgeCount})` : t("notif.title");

  return (
    <Link
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-deep-plum transition hover:bg-soft-lilac/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
      href="/notifications"
      aria-label={label}
      title={label}
    >
      <NavIcon icon="notifications" className="h-5 w-5" />
      {badgeCount > 0 && (
        <span className="gradient-aurora absolute right-0.5 top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </Link>
  );
}
