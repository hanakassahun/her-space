"use client";

import Link from "next/link";
import { desktopAccountNavOrder, isNavItemActive, navConfig, resolveNavHref } from "@/lib/nav";
import NavIcon from "@/components/NavIcon";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/components/LanguageProvider";

type AccountMenuProps = {
  pathname: string;
  userId: string;
  isAdmin: boolean;
  onClose: () => void;
};

export default function AccountMenu({ pathname, userId, isAdmin, onClose }: AccountMenuProps) {
  const { t } = useLanguage();

  async function logOut() {
    onClose();
    await supabase.auth.signOut();
  }

  return (
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
            onClick={onClose}
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
  );
}
