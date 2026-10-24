"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export default function ConnectionBanner() {
  const { t } = useLanguage();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateConnectionState = () => {
      setIsOffline(typeof navigator !== "undefined" && !navigator.onLine);
    };

    updateConnectionState();
    window.addEventListener("online", updateConnectionState);
    window.addEventListener("offline", updateConnectionState);

    return () => {
      window.removeEventListener("online", updateConnectionState);
      window.removeEventListener("offline", updateConnectionState);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900"
    >
      {t("offline.banner")}
    </div>
  );
}
