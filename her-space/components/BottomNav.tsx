"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNavOrder, moreNavOrder, isNavItemActive, navConfig, resolveNavHref } from "@/lib/nav";
import { supabase } from "@/lib/supabase";
import NavIcon from "@/components/NavIcon";
import { useLanguage } from "@/components/LanguageProvider";

type BottomNavProps = {
  userId: string;
  isAdmin: boolean;
};

export default function BottomNav({ userId, isAdmin }: BottomNavProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [sheetPresented, setSheetPresented] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreActive = moreNavOrder.some(
    (key) => (!navConfig[key].adminOnly || isAdmin) && isNavItemActive(key, pathname)
  );

  function closeMore() {
    setMoreOpen(false);
    setSheetPresented(false);
    setDragOffset(0);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = setTimeout(() => setSheetMounted(false), reducedMotion ? 0 : 250);
  }

  function openMore() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setSheetMounted(true);
    setMoreOpen(true);
    window.requestAnimationFrame(() => setSheetPresented(true));
  }

  function toggleMore() {
    if (moreOpen) closeMore();
    else openMore();
  }

  function handleDragStart(event: PointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDragMove(event: PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return;
    setDragOffset(Math.max(0, event.clientY - dragStartY.current));
  }

  function handleDragEnd() {
    if (dragStartY.current === null) return;
    const shouldClose = dragOffset > 80;
    dragStartY.current = null;
    setDragging(false);
    if (shouldClose) closeMore();
    else setDragOffset(0);
  }

  useEffect(() => {
    if (!moreOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMore();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  useEffect(() => {
    if (!sheetMounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sheetMounted]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  async function handleLogout() {
    closeMore();
    await supabase.auth.signOut();
  }

  return (
    <>
      {sheetMounted && (
        <div
          className={`more-overlay fixed inset-0 z-50 flex items-end bg-deep-plum/20 md:hidden ${sheetPresented ? "opacity-100" : "opacity-0"}`}
          onClick={closeMore}
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
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <span className="h-1.5 w-10 rounded-full bg-deep-plum/25" />
            </div>
            <div className="mb-4 flex items-center justify-between">
              <h2 id="more-heading" className="text-lg font-semibold text-deep-plum">{t("nav.more")}</h2>
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-deep-plum hover:bg-soft-lilac/50"
                type="button"
                aria-label="Close menu"
                onClick={closeMore}
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
                      onClick={closeMore}
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
              onClick={toggleMore}
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