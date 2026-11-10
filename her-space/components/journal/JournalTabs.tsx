"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { useRouter } from "next/navigation";
import { useSwipeTabs } from "@/lib/useSwipeTabs";

export default function JournalTabs() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const router = useRouter();
  const onCalendar = pathname === "/journal/calendar";
  const swipeHandlers = useSwipeTabs({
    count: 2,
    index: onCalendar ? 1 : 0,
    enabled: true,
    onChange: (index) => router.push(index === 1 ? "/journal/calendar" : "/journal"),
  });

  return (
    <nav {...swipeHandlers} aria-label={t("journal.title")} className="touch-pan-y flex w-full rounded-full border border-soft-lilac bg-white/70 p-1">
      <div data-swipe-content className="flex w-full">
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
      </div>
    </nav>
  );
}
