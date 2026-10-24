"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNavOrder, moreNavOrder, isNavItemActive, navConfig, resolveNavHref } from "@/lib/nav";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import NavIcon from "@/components/NavIcon";
import { useLanguage } from "@/components/LanguageProvider";

const BottomNavMoreSheet = dynamic(() => import("@/components/BottomNavMoreSheet"), { ssr: false });

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, isAdmin } = useAuth();
  const userId = user?.id ?? "";
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
        <BottomNavMoreSheet
          pathname={pathname}
          userId={userId}
          isAdmin={isAdmin}
          sheetPresented={sheetPresented}
          dragging={dragging}
          dragOffset={dragOffset}
          onClose={closeMore}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onLogout={() => void handleLogout()}
        />
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