"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNavOrder, moreNavOrder, isNavItemActive, navConfig, resolveNavHref } from "@/lib/nav";
import { supabase } from "@/lib/supabase";
import NavIcon from "@/components/NavIcon";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type BottomNavProps = {
  userId: string;
  isAdmin: boolean;
};

export default function BottomNav({ userId, isAdmin }: BottomNavProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreNavOrder.some(
    (key) => (!navConfig[key].adminOnly || isAdmin) && isNavItemActive(key, pathname)
  );

  useEffect(() => {
    if (!moreOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  async function handleLogout() {
    setMoreOpen(false);
    await supabase.auth.signOut();
  }

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-deep-plum/20 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <section
            className="glass nav-sheet-enter w-full rounded-b-none rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="more-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="more-heading" className="text-lg font-semibold text-deep-plum">{t("nav.more")}</h2>
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-deep-plum hover:bg-soft-lilac/50"
                type="button"
                aria-label="Close menu"
                onClick={() => setMoreOpen(false)}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <ul className="space-y-1">
              {moreNavOrder.map((key) => {
                const item = navConfig[key];
                if (item.adminOnly && !isAdmin) return null;
                const active = isNavItemActive(key, pathname);
                return (
                  <li key={key}>
                    <Link
                      className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium ${
                        active ? "bg-soft-lilac/70 text-deep-plum" : "text-gray-700 hover:bg-white/70"
                      }`}
                      href={resolveNavHref(key, userId)}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMoreOpen(false)}
                    >
                      <NavIcon icon={item.icon} />
                      {t(item.label)}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-medium text-rose-900 hover:bg-rose-100/70"
                  type="button"
                  onClick={handleLogout}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5M15 12H3m9-8h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" />
                  </svg>
                  {t("nav.logout")}
                </button>
              </li>
            </ul>
            <LanguageSwitcher className="mt-4" />
          </section>
        </div>
      )}

      <nav
        className="glass fixed inset-x-3 bottom-0 z-40 rounded-b-none px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:hidden"
        aria-label="Primary navigation"
      >
        <ul className="mx-auto flex max-w-lg items-center justify-around gap-1">
          {mobileNavOrder.map((key) => {
            const item = navConfig[key];
            const active = isNavItemActive(key, pathname);
            const isWrite = key === "write";
            return (
              <li className="min-w-0 flex-1" key={key}>
                <Link
                  className={isWrite
                    ? "mx-auto flex h-12 w-12 items-center justify-center rounded-full gradient-aurora text-white shadow-glow"
                    : `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-medium ${active ? "text-deep-plum" : "text-gray-600"}`}
                  href={resolveNavHref(key, userId)}
                  aria-label={isWrite ? t("nav.writePost") : t(item.label)}
                  aria-current={active ? "page" : undefined}
                  title={isWrite ? t("nav.writePost") : t(item.label)}
                >
                  <NavIcon icon={item.icon} className={isWrite ? "h-6 w-6" : "h-5 w-5"} />
                  {!isWrite && <span className="truncate">{t(item.label)}</span>}
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button
              className={`flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-medium ${moreActive || moreOpen ? "text-deep-plum" : "text-gray-600"}`}
              type="button"
              aria-label={t("nav.more")}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              aria-current={moreActive ? "page" : undefined}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <NavIcon icon="more" />
              <span>{t("nav.more")}</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}