"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const hideOnAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

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

  return (
    <>
      {showNavigation && userId && <AppHeader userId={userId} isAdmin={isAdmin} />}
      <div className={showNavigation ? "min-h-0 flex-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0" : "min-h-0 flex-1"}>
        {children}
      </div>
      {showNavigation && userId && <BottomNav userId={userId} isAdmin={isAdmin} />}
    </>
  );
}