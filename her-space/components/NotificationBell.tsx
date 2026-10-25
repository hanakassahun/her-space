"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import NavIcon from "@/components/NavIcon";
import { supabase } from "@/lib/supabase";

export default function NotificationBell() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (!error) setUnreadCount(count ?? 0);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    void refreshCount();
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
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("her-space:notifications-changed", handleNotificationsChanged);
    };
  }, [refreshCount, user]);

  if (!user) return null;

  const label = unreadCount > 0 ? `${t("notif.title")} (${unreadCount})` : t("notif.title");

  return (
    <Link
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-deep-plum transition hover:bg-soft-lilac/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
      href="/notifications"
      aria-label={label}
      title={label}
    >
      <NavIcon icon="notifications" className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="gradient-aurora absolute right-0.5 top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
