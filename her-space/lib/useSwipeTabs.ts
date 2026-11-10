"use client";

import { useEffect, useRef, type PointerEvent } from "react";

type SwipeHandlers = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
};

type Gesture = { x: number; y: number; time: number; pointerId: number };

function isExcluded(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (window.getSelection()?.toString()) return true;
  if (target.closest("input, textarea, select, [contenteditable], [role='slider'], [role='dialog'], dialog, [data-bottom-sheet], [data-sheet], [data-vaul-drawer], [aria-modal='true']")) return true;
  let node: Element | null = target;
  while (node) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth) return true;
    node = node.parentElement;
  }
  return false;
}

export function useSwipeTabs({
  count,
  index,
  onChange,
  enabled,
}: {
  count: number;
  index: number;
  onChange: (index: number) => void;
  enabled: boolean;
}): SwipeHandlers {
  const gesture = useRef<Gesture | null>(null);
  const direction = useRef<1 | -1 | null>(null);
  const previousIndex = useRef(index);
  useEffect(() => {
    if (previousIndex.current !== index && direction.current) {
      const content = document.querySelector<HTMLElement>("[data-swipe-content]");
      if (content && window.matchMedia("(prefers-reduced-motion: no-preference)").matches
        && document.documentElement.dataset.calm !== "true") {
        content.style.transition = "none";
        content.style.opacity = "0";
        content.style.transform = `translateX(${direction.current * 24}px)`;
        window.requestAnimationFrame(() => {
          content.style.transition = "transform 180ms ease, opacity 180ms ease";
          content.style.transform = "translateX(0)";
          content.style.opacity = "1";
        });
        const timeout = window.setTimeout(() => {
          content.style.transition = "";
          content.style.opacity = "";
          content.style.transform = "";
        }, 190);
        direction.current = null;
        previousIndex.current = index;
        return () => window.clearTimeout(timeout);
      }
      direction.current = null;
    }
    previousIndex.current = index;
  }, [index]);
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.pointerType !== "touch" || event.clientX < 24 || window.innerWidth - event.clientX < 24
      || isExcluded(event.target)) {
      gesture.current = null;
      return;
    }
    gesture.current = { x: event.clientX, y: event.clientY, time: performance.now(), pointerId: event.pointerId };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || event.pointerType !== "touch" || current.pointerId !== event.pointerId) return;
    if (window.getSelection()?.toString()) {
      reset(event.currentTarget);
      return;
    }
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      const content = event.currentTarget.querySelector<HTMLElement>("[data-swipe-content]");
      if (content && window.matchMedia("(prefers-reduced-motion: no-preference)").matches
        && document.documentElement.dataset.calm !== "true") {
        content.style.transform = `translateX(${Math.max(-24, Math.min(24, dx * 0.25))}px)`;
      }
    }
  };
  const reset = (element?: HTMLElement) => {
    const content = element?.querySelector<HTMLElement>("[data-swipe-content]");
    if (content) content.style.transform = "";
    gesture.current = null;
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || event.pointerType !== "touch" || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    const duration = performance.now() - current.time;
    reset(event.currentTarget);
    if (duration < 700 && Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      const next = index + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < count) {
        const fromIndex = index;
        direction.current = dx < 0 ? 1 : -1;
        onChange(next);
        window.requestAnimationFrame(() => {
          if (previousIndex.current === fromIndex) direction.current = null;
        });
      }
    }
  };
  const onPointerCancel = (event: PointerEvent<HTMLElement>) => { reset(event.currentTarget); };
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
