"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { isNavItemActive, moreNavOrder, navConfig, resolveNavHref } from "@/lib/nav";
import { useLanguage } from "@/components/LanguageProvider";
import NavIcon from "@/components/NavIcon";

type BottomNavMoreSheetProps = {
  pathname: string;
  userId: string;
  isAdmin: boolean;
  sheetPresented: boolean;
  dragging: boolean;
  dragOffset: number;
  onClose: () => void;
  onDragStart: (event: PointerEvent<HTMLDivElement>) => void;
  onDragMove: (event: PointerEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onLogout: () => void;
};

export default function BottomNavMoreSheet({
  pathname,
  userId,
  isAdmin,
  sheetPresented,
  dragging,
  dragOffset,
  onClose,
  onDragStart,
  onDragMove,
  onDragEnd,
  onLogout,
}: BottomNavMoreSheetProps) {
  const { t } = useLanguage();

  return (
    <div
      className={`more-overlay fixed inset-0 z-50 flex items-end bg-deep-plum/20 md:hidden ${sheetPresented ? "opacity-100" : "opacity-0"}`}
      onClick={onClose}
    >
      <section
        className={`more-sheet glass w-full rounded-b-none rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] ${dragging ? "more-sheet-dragging" : ""}`}
        style={{ transform: sheetPresented ? `translateY(${dragOffset}px)` : "translateY(100%)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="-mt-2 mb-4 flex min-h-6 cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-deep-plum/25" />
        </div>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="more-heading" className="text-lg font-semibold text-deep-plum">{t("nav.more")}</h2>
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-deep-plum hover:bg-soft-lilac/50"
            type="button"
            aria-label="Close menu"
            onClick={onClose}
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
                  className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium ${active ? "bg-soft-lilac/70 text-deep-plum" : "text-gray-700 hover:bg-white/70"}`}
                  href={resolveNavHref(key, userId)}
                  aria-current={active ? "page" : undefined}
                  onClick={onClose}
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
              onClick={onLogout}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5M15 12H3m9-8h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" />
              </svg>
              {t("nav.logout")}
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}
