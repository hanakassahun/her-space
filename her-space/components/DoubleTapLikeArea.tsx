"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

type DoubleTapLikeAreaProps = {
  children: ReactNode;
  liked: boolean;
  onLike: () => void;
  className?: string;
};

const hearts = [
  { x: "-34px", y: "-28px" },
  { x: "0px", y: "-42px" },
  { x: "34px", y: "-28px" },
  { x: "-42px", y: "14px" },
  { x: "0px", y: "30px" },
  { x: "42px", y: "14px" },
];

export default function DoubleTapLikeArea({
  children,
  liked,
  onLike,
  className = "",
}: DoubleTapLikeAreaProps) {
  const previousPointer = useRef<{ time: number; x: number; y: number; type: string } | null>(null);
  const burstTimeout = useRef<number | null>(null);
  const [burstId, setBurstId] = useState(0);
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => () => {
    if (burstTimeout.current !== null) window.clearTimeout(burstTimeout.current);
  }, []);

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a, button, input, textarea, select, [role='button'], [data-read-more]")) {
      previousPointer.current = null;
      return;
    }
    if (window.getSelection()?.isCollapsed === false) {
      previousPointer.current = null;
      return;
    }

    const now = performance.now();
    const previous = previousPointer.current;
    const isDoubleTap = previous
      && previous.type === event.pointerType
      && now - previous.time <= 300
      && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 24;
    previousPointer.current = { time: now, x: event.clientX, y: event.clientY, type: event.pointerType };
    if (!isDoubleTap || liked) return;

    onLike();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const calmMode = document.documentElement.dataset.calm === "true";
    if (reducedMotion || calmMode) return;
    setBurstId((current) => current + 1);
    setShowBurst(true);
    if (burstTimeout.current !== null) window.clearTimeout(burstTimeout.current);
    burstTimeout.current = window.setTimeout(() => setShowBurst(false), 700);
  }

  return (
    <div className={`relative touch-manipulation ${className}`} onPointerUp={handlePointerUp} onPointerCancel={() => { previousPointer.current = null; }}>
      {children}
      {showBurst && (
        <span key={burstId} className="pointer-events-none absolute inset-0 z-10 overflow-visible" aria-hidden="true">
          {hearts.map(({ x, y }, index) => (
            <span
              className="heart-burst-heart absolute left-1/2 top-1/2 text-rose-500"
              key={`${burstId}-${index}`}
              style={{ "--heart-x": x, "--heart-y": y } as CSSProperties}
            >
              ♥
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
