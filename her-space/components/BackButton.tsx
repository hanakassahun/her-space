"use client";

import { usePathname, useRouter } from "next/navigation";
import { getBackFallbackPath } from "@/lib/nav";
import { useLanguage } from "@/components/LanguageProvider";

export default function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  function handleBack() {
    if (typeof window === "undefined") return;

    const hasHistory = window.history.length > 1;
    const referrer = document.referrer;
    const shouldUseBack =
      hasHistory && referrer &&
      (() => {
        try {
          return new URL(referrer).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

    if (shouldUseBack) {
      router.back();
      return;
    }

    router.push(getBackFallbackPath(pathname));
  }

  return (
    <button
      type="button"
      aria-label={t("nav.goBack")}
      title={t("nav.goBack")}
      onClick={handleBack}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/70 text-deep-plum shadow-sm transition-colors hover:bg-soft-lilac/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 18L9 12L15 6M9 12H21" />
      </svg>
    </button>
  );
}
