"use client";

import { useEffect } from "react";

export default function AmbientBackground() {
  useEffect(() => {
    const root = document.documentElement;
    const setMood = () => {
      const hour = new Date().getHours();
      root.dataset.tod = hour >= 5 && hour < 10
        ? "morning"
        : hour >= 10 && hour < 17
          ? "day"
          : hour >= 17 && hour < 21
            ? "evening"
            : "night";
    };
    const setVisibility = () => {
      root.classList.toggle("tab-hidden", document.visibilityState === "hidden");
    };
    setMood();
    const interval = window.setInterval(setMood, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", setVisibility);
    setVisibility();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", setVisibility);
      root.classList.remove("tab-hidden");
    };
  }, []);

  return (
    <div className="ambient-background fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
      <span className="ambient-disc ambient-disc-one" />
      <span className="ambient-disc ambient-disc-two" />
      <span className="ambient-disc ambient-disc-three" />
    </div>
  );
}
