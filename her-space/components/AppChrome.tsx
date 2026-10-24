"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import ConnectionBanner from "@/components/ConnectionBanner";
import Card from "@/components/ui/Card";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const hideOnAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";
  const isMaintenanceMode =
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true" && pathname !== "/login";

  useEffect(() => {
    const device = window.navigator as Navigator & { deviceMemory?: number };
    if (typeof device.deviceMemory === "number" && device.deviceMemory <= 2) {
      document.documentElement.dataset.lowend = "true";
    } else {
      delete document.documentElement.dataset.lowend;
    }

    return () => {
      delete document.documentElement.dataset.lowend;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function setAdminForUser(currentUserId: string | null) {
      if (!currentUserId) {
        if (active) setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (active) setIsAdmin(Boolean(data));
    }

    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      const currentUserId = data.user?.id ?? null;
      setUserId(currentUserId);
      await setAdminForUser(currentUserId);
      if (active) setSessionChecked(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUserId = session?.user.id ?? null;
      if (!active) return;
      setUserId(currentUserId);
      if (!currentUserId) setIsAdmin(false);
      window.setTimeout(() => void setAdminForUser(currentUserId), 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const showNavigation = sessionChecked && Boolean(userId) && !hideOnAuthRoute;

  if (isMaintenanceMode) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg space-y-4 border border-white/60 bg-white/75 p-8 text-center shadow-[0_20px_60px_rgba(84,54,110,0.12)] backdrop-blur-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-soft-lilac/40 text-3xl text-deep-plum">⏳</div>
          <h1 className="text-2xl font-bold text-deep-plum">{t("maintenance.title")}</h1>
          <p className="text-sm leading-6 text-gray-700">{t("maintenance.body")}</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      {showNavigation && userId && <AppHeader userId={userId} isAdmin={isAdmin} />}
      {showNavigation && userId && <ConnectionBanner />}
      <div className={showNavigation ? "min-h-0 flex-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0" : "min-h-0 flex-1"}>
        {children}
      </div>
      {showNavigation && userId && <BottomNav userId={userId} isAdmin={isAdmin} />}
    </>
  );
}