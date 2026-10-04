"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { desktopNavOrder, isNavItemActive, isTopLevelPath, navConfig, resolveNavHref } from "@/lib/nav";
import NavIcon from "@/components/NavIcon";
import { supabase } from "@/lib/supabase";

type AppHeaderProps = {
  userId: string;
  isAdmin: boolean;
};

export default function AppHeader({ userId, isAdmin }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const showBack = !isTopLevelPath(pathname);

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
        <Link className="shrink-0 bg-clip-text text-lg font-bold text-transparent gradient-aurora md:text-xl" href={navConfig.home.href}>
          Her Space
        </Link>

        <nav className="ml-auto hidden min-w-0 overflow-x-auto md:block" aria-label="Main navigation">
          <ul className="flex min-w-max items-center gap-1">
            {desktopNavOrder.map((key) => {
              const item = navConfig[key];
              if (item.adminOnly && !isAdmin) return null;
              const active = isNavItemActive(key, pathname);
              return (
                <li key={key}>
                  <Link
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                      active ? "bg-soft-lilac/70 text-deep-plum" : "text-gray-700 hover:bg-white/80 hover:text-deep-plum"
                    }`}
                    href={resolveNavHref(key, userId)}
                    aria-current={active ? "page" : undefined}
                  >
                    <NavIcon icon={item.icon} className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          className="ml-2 hidden min-h-11 shrink-0 rounded-full px-3 text-xs font-medium text-deep-plum hover:bg-white/80 md:inline-flex md:items-center"
          type="button"
          onClick={() => void supabase.auth.signOut()}
        >
          Log out
        </button>
      </div>
    </header>
  );
}