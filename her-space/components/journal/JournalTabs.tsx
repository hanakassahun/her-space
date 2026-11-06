"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

export default function JournalTabs() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const onCalendar = pathname === "/journal/calendar";

  return (
    <nav aria-label={t("journal.title")} className="flex w-full rounded-full border border-soft-lilac bg-white/70 p-1">
      <Link
        href="/journal"
        aria-current={!onCalendar ? "page" : undefined}
        className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-3 text-center text-sm font-semibold ${!onCalendar ? "gradient-aurora text-white" : "text-deep-plum"}`}
      >
        {t("cal.tabEntries")}
      </Link>
      <Link
        href="/journal/calendar"
        aria-current={onCalendar ? "page" : undefined}
        className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-3 text-center text-sm font-semibold ${onCalendar ? "gradient-aurora text-white" : "text-deep-plum"}`}
      >
        {t("cal.tabCalendar")}
      </Link>
    </nav>
  );
}
