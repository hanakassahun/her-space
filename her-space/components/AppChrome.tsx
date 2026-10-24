"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import ConnectionBanner from "@/components/ConnectionBanner";
import Card from "@/components/ui/Card";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
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

  const showNavigation = !loading && Boolean(userId) && !hideOnAuthRoute;

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
      {showNavigation && userId && <AppHeader />}
      {showNavigation && userId && <ConnectionBanner />}
      <div className={showNavigation ? "min-h-0 flex-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0" : "min-h-0 flex-1"}>
        {children}
      </div>
      {showNavigation && userId && <BottomNav />}
    </>
  );
}