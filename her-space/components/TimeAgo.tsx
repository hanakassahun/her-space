"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { formatRelativeDate, formatShortDate } from "@/lib/time";

type TimeAgoProps = {
  date: string | Date | null | undefined;
  className?: string;
  prefix?: string;
};

export default function TimeAgo({ date, className, prefix }: TimeAgoProps) {
  const { lang, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    setMounted(true);
    const refresh = () => setTick(Date.now());

    refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, 60000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const resolvedDate = date ? new Date(date) : null;

  const fullDateLabel = useMemo(() => {
    if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) return "";
    const locale = lang === "am" ? "am-ET" : "en-US";
    return resolvedDate.toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [lang, resolvedDate]);

  const visibleText = useMemo(() => {
    if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) return "";
    return mounted ? formatRelativeDate(resolvedDate, lang, t) : formatShortDate(resolvedDate, lang);
  }, [lang, mounted, resolvedDate, t, tick]);

  if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) return null;

  const text = prefix ? `${prefix} ${visibleText}` : visibleText;

  return (
    <time className={className} dateTime={resolvedDate.toISOString()} title={fullDateLabel}>
      {text}
    </time>
  );
}
