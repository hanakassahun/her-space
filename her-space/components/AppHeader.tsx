"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { desktopAccountNavOrder, desktopPrimaryNavOrder, isNavItemActive, isTopLevelPath, navConfig, resolveNavHref } from "@/lib/nav";
import NavIcon from "@/components/NavIcon";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type AppHeaderProps = {
  userId: string;
  isAdmin: boolean;
};

export default function AppHeader({ userId, isAdmin }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const showBack = !isTopLevelPath(pathname);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [accountOpen]);

  async function logOut() {
    setAccountOpen(false);
    await supabase.auth.signOut();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-pearl-white/95">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center gap-3 px-4 md:min-h-16 md:px-6">
        {showBack && (
          <button
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-deep-plum hover:bg-soft-lilac/50 md:hidden"
            type="button"
            aria-label="Go back"
            title="Go back"
            onClick={() => router.back()}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6M9 12h12" />
            </svg>
          </button>
        )}
        <Link className="shrink-0 text-lg font-bold text-deep-plum md:text-xl" href={navConfig.home.href}>
          Her Space
        </Link>

        <nav className="ml-auto hidden min-w-0 flex-1 justify-center md:flex" aria-label="Main navigation">
          <ul className="flex min-w-0 items-center justify-center gap-0.5 lg:gap-1">
            {desktopPrimaryNavOrder.map((key) => {
              const item = navConfig[key];
              const active = isNavItemActive(key, pathname);
              return (
                <li key={key}>
                  <Link
                    className={`inline-flex min-h-11 whitespace-nowrap items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors lg:gap-1.5 lg:px-2.5 lg:text-xs ${
                      active ? "bg-soft-lilac/70 text-deep-plum" : "text-gray-700 hover:bg-white/80 hover:text-deep-plum"
                    }`}
                    href={resolveNavHref(key, userId)}
                    aria-current={active ? "page" : undefined}
                  >
                    <NavIcon icon={item.icon} className="hidden h-4 w-4 lg:block" />
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          className="gradient-aurora ml-1 hidden min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-white shadow-glow md:inline-flex"
          href={resolveNavHref("write", userId)}
        >
          <NavIcon icon={navConfig.write.icon} className="h-4 w-4" />
          {t(navConfig.write.label)}
        </Link>
        <LanguageSwitcher className="inline-flex" />
        <div className="relative hidden shrink-0 md:block" ref={accountMenuRef}>
          <button
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${accountOpen ? "border-soft-lilac bg-soft-lilac text-deep-plum" : "border-white/70 bg-white/75 text-deep-plum hover:bg-white"}`}
            type="button"
            aria-label={t("nav.accountMenu")}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((open) => !open)}
          >
            H
          </button>
          {accountOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-white/70 bg-pearl-white p-2 shadow-xl" role="menu" aria-label="Account menu">
              {desktopAccountNavOrder.map((key) => {
                const item = navConfig[key];
                if (item.adminOnly && !isAdmin) return null;
                const active = isNavItemActive(key, pathname);
                return (
                  <Link
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${active ? "bg-soft-lilac/70 text-deep-plum" : "text-gray-700 hover:bg-white"}`}
                    href={resolveNavHref(key, userId)}
                    key={key}
                    role="menuitem"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setAccountOpen(false)}
                  >
                    <NavIcon icon={item.icon} className="h-4 w-4" />
                    {t(item.label)}
                  </Link>
                );
              })}
              <button
                className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-rose-900 hover:bg-rose-50"
                type="button"
                role="menuitem"
                onClick={() => void logOut()}
              >
                {t("nav.logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}