"use client";

import { useEffect } from "react";

export default function AmbientBackground() {
  useEffect(() => {
    const root = document.documentElement;
    const setMood = () => {
      const hour = new Date().getHours();
      const automaticMood = hour >= 5 && hour < 10
        ? "morning"
        : hour >= 10 && hour < 17
          ? "day"
          : hour >= 17 && hour < 21
            ? "evening"
            : "night";
      let moodOverride: string | null = null;
      try {
        moodOverride = window.localStorage.getItem("moodOverride");
      } catch {
        // The automatic mood remains available when storage is disabled.
      }
      root.dataset.tod = moodOverride === "morning" || moodOverride === "day"
        || moodOverride === "evening" || moodOverride === "night"
        ? moodOverride
        : automaticMood;
    };
    const setVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      root.classList.toggle("tab-hidden", hidden);
      if (!hidden) setMood();
    };
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
