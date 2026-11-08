"use client";

import { useId } from "react";

export const COVER_KEYS = [
  "aurora",
  "dusk",
  "bloom",
  "tide",
  "meadow",
  "ember",
  "mist",
  "grove",
  "night",
  "dawn",
] as const;

export type CoverKey = (typeof COVER_KEYS)[number];

const palettes: Record<CoverKey, [string, string, string]> = {
  aurora: ["#D8C9F0", "#A9D7D1", "#F5D6D0"],
  dusk: ["#C7B5D9", "#E6B7AE", "#F0D8B8"],
  bloom: ["#F1C9D7", "#DCC8EF", "#F8E2BD"],
  tide: ["#B7D9E5", "#B8D7D0", "#D5C9ED"],
  meadow: ["#C7DDBE", "#E8D9A8", "#D4C9E9"],
  ember: ["#F0BDA8", "#E6C28E", "#D8B8D8"],
  mist: ["#D9D8E9", "#C6DCE5", "#E9D4DD"],
  grove: ["#B8D2C0", "#D5D6A9", "#B7D7D2"],
  night: ["#B9B7D9", "#A8C6D4", "#D2B9D2"],
  dawn: ["#F4D6B2", "#EAC3CE", "#C9D5E8"],
};

export default function CoverArt({
  cover,
  className = "",
}: {
  cover: string | null | undefined;
  className?: string;
}) {
  const gradientId = `cover-${useId().replace(/:/g, "")}`;
  if (!COVER_KEYS.some((key) => key === cover)) return null;
  const [start, middle, end] = palettes[cover as CoverKey];

  return (
    <svg
      className={`block w-full ${className}`}
      viewBox="0 0 600 120"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={start} />
          <stop offset="0.55" stopColor={middle} />
          <stop offset="1" stopColor={end} />
        </linearGradient>
      </defs>
      <rect width="600" height="120" fill={`url(#${gradientId})`} />
      <path d="M0 84C92 28 154 41 240 78s143 36 221-7 108-36 139-22v71H0Z" fill={end} opacity=".42" />
      <path d="M0 104c78-39 153-42 229-10s138 42 211 9 111-39 160-19v36H0Z" fill={start} opacity=".5" />
      <ellipse cx="92" cy="16" rx="112" ry="38" fill="white" opacity=".22" />
      <ellipse cx="510" cy="112" rx="152" ry="46" fill={middle} opacity=".38" />
    </svg>
  );
}
