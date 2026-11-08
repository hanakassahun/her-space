"use client";

import { useEffect, useState, type CSSProperties } from "react";

type BurstVariant = "hearts" | "petals" | "sprout";

export default function Burst({
  variant,
  trigger,
  count = variant === "hearts" ? 6 : 12,
  duration = variant === "hearts" ? 700 : 900,
}: {
  variant: BurstVariant;
  trigger: number;
  count?: number;
  duration?: number;
}) {
  const [finishedTrigger, setFinishedTrigger] = useState(0);
  const visible = trigger > 0 && trigger > finishedTrigger;
  useEffect(() => {
    if (trigger < 1 || trigger <= finishedTrigger) return;
    const timeout = window.setTimeout(() => setFinishedTrigger(trigger), duration);
    return () => window.clearTimeout(timeout);
  }, [duration, finishedTrigger, trigger]);

  if (!visible) return null;
  if (variant === "sprout") {
    return (
      <span className="burst-overlay" aria-hidden="true">
        <svg className="burst-sprout" viewBox="0 0 32 32">
          <path d="M16 28V15m0 7c-8 0-11-5-11-11 7 0 11 4 11 11Zm0-5c0-7 4-11 11-11 0 7-4 11-11 11Z" fill="none" stroke="#688f68" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          <path d="M5 11c7 0 11 4 11 11m11-7c-7 0-11 4-11 11" fill="none" stroke="#9bbd8c" strokeLinecap="round" strokeWidth="2" />
        </svg>
      </span>
    );
  }

  return (
    <span className="burst-overlay" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => {
        const angle = (Math.PI * 2 * index) / count;
        const distance = variant === "hearts" ? 28 : 38;
        const x = Math.round(Math.cos(angle) * distance);
        const y = Math.round(Math.sin(angle) * distance);
        return (
          <svg
            className={`burst-shape burst-${variant}`}
            key={index}
            viewBox="0 0 24 24"
            style={{
              "--burst-x": `${x}px`,
              "--burst-y": `${y}px`,
              "--burst-duration": `${duration}ms`,
            } as CSSProperties}
          >
            {variant === "hearts"
              ? <path d="M20.8 8.8c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" fill="currentColor" />
              : <path d="M12 2c5 4 8 8 5 13-1.2 2-3 3-5 5-2-2-3.8-3-5-5C4 10 7 6 12 2Z" fill="currentColor" />}
          </svg>
        );
      })}
    </span>
  );
}
