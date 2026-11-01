import type { ReactNode } from "react";

export const AVATAR_KEYS = [
  "sun",
  "moon",
  "leaf",
  "wave",
  "star",
  "bloom",
  "cloud",
  "hill",
  "seed",
  "shell",
  "spark",
  "path",
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

const avatarArt: Record<AvatarKey, ReactNode> = {
  sun: <><circle cx="32" cy="32" r="13" fill="#F4A8B8" /><path d="M32 10v7m0 30v7M10 32h7m30 0h7M16.4 16.4l5 5m21.2 21.2 5 5m0-31.2-5 5M21.4 42.6l-5 5" stroke="#8E78C2" strokeWidth="3" strokeLinecap="round" /><circle cx="32" cy="32" r="5" fill="#F8DDE3" /></>,
  moon: <><path d="M43 14a20 20 0 1 0 7 32A22 22 0 0 1 43 14Z" fill="#9A8ACB" /><circle cx="23" cy="25" r="3" fill="#78BCA7" /><circle cx="39" cy="39" r="2.5" fill="#F4A8B8" /></>,
  leaf: <><path d="M16 45C18 25 31 16 49 15 48 34 39 47 20 49Z" fill="#78BCA7" /><path d="M19 46c8-8 15-15 26-24" stroke="#668C84" strokeWidth="3" strokeLinecap="round" /><path d="m27 37-1-10m10 3 8-1" stroke="#DDF1E8" strokeWidth="2.5" strokeLinecap="round" /></>,
  wave: <><path d="M12 27c7-8 13 8 20 0s13 8 20 0" fill="none" stroke="#8B9CE0" strokeWidth="5" strokeLinecap="round" /><path d="M12 39c7-8 13 8 20 0s13 8 20 0" fill="none" stroke="#78BCA7" strokeWidth="5" strokeLinecap="round" /><circle cx="20" cy="19" r="3" fill="#F4A8B8" /></>,
  star: <><path d="m32 12 5.5 13.5L52 27l-11 9.5L44 51l-12-7.5L20 51l3-14.5L12 27l14.5-1.5Z" fill="#F2A5B5" /><circle cx="32" cy="32" r="5" fill="#9A8ACB" /><circle cx="48" cy="17" r="2.5" fill="#78BCA7" /></>,
  bloom: <><path d="M32 17c5-7 14-1 10 6 8-2 12 8 4 11 5 7-3 14-10 9-4 8-14 4-12-4-8 1-12-9-5-13-4-7 5-13 13-9Z" fill="#E9B8D3" /><circle cx="32" cy="32" r="5" fill="#F7E5A8" /><path d="M32 37v11" stroke="#78BCA7" strokeWidth="3" strokeLinecap="round" /></>,
  cloud: <><path d="M18 42h28a8 8 0 0 0 0-16 13 13 0 0 0-25-2 9 9 0 0 0-3 18Z" fill="#A7B3E8" /><circle cx="25" cy="48" r="3" fill="#78BCA7" /><circle cx="39" cy="48" r="2.5" fill="#F2A5B5" /></>,
  hill: <><path d="M10 46 27 24l10 13 7-9 10 18Z" fill="#78BCA7" /><path d="m22 31 5-7 6 8" fill="none" stroke="#F7F1FA" strokeWidth="3" strokeLinejoin="round" /><circle cx="45" cy="19" r="5" fill="#F2A5B5" /></>,
  seed: <><path d="M32 47c-12-9-13-22 0-31 13 9 12 22 0 31Z" fill="#F2A5B5" /><path d="M32 45V27" stroke="#78BCA7" strokeWidth="3" strokeLinecap="round" /><path d="M32 36c-6-7-11-6-13-5 3 6 7 9 13 9m0-7c5-7 10-7 13-6-2 6-7 9-13 10" fill="#78BCA7" /></>,
  shell: <><path d="M15 43a17 17 0 0 1 34 0Z" fill="#F2A5B5" /><path d="M32 43V27m-9 16 3-14m15 14-3-14m-15 4-5 9m27-9 5 9" stroke="#9A8ACB" strokeWidth="2.5" strokeLinecap="round" /><path d="M15 43h34" stroke="#78BCA7" strokeWidth="3" strokeLinecap="round" /></>,
  spark: <><path d="m32 11 5.5 15.5L53 32l-15.5 5.5L32 53l-5.5-15.5L11 32l15.5-5.5Z" fill="#A99ADD" /><circle cx="47" cy="17" r="4" fill="#F2A5B5" /><circle cx="17" cy="46" r="3.5" fill="#78BCA7" /></>,
  path: <><path d="M18 50c2-9 2-13 10-18s8-9 9-18" fill="none" stroke="#9A8ACB" strokeWidth="6" strokeLinecap="round" /><circle cx="20" cy="49" r="5" fill="#78BCA7" /><circle cx="39" cy="14" r="5" fill="#F2A5B5" /></>,
};

const backgrounds: Record<AvatarKey, string> = {
  sun: "#FCE8EC",
  moon: "#EEEAF8",
  leaf: "#E5F3EC",
  wave: "#E8ECFB",
  star: "#FCE8EC",
  bloom: "#F2ECF8",
  cloud: "#E9EDFB",
  hill: "#E5F3EC",
  seed: "#FCE8EC",
  shell: "#F2ECF8",
  spark: "#E8ECFB",
  path: "#E5F3EC",
};

export default function Avatar({
  name,
  avatar,
  size,
}: {
  name: string;
  avatar: string | null;
  size: number;
}) {
  const dimension = `${size}px`;
  if (!avatar || !AVATAR_KEYS.includes(avatar as AvatarKey)) {
    return (
      <span
        className="gradient-aurora flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
        style={{ width: dimension, height: dimension, fontSize: `${size * 0.4}px` }}
        aria-hidden="true"
      >
        {name.trim().charAt(0).toLocaleUpperCase() || "H"}
      </span>
    );
  }

  const key = avatar as AvatarKey;
  return (
    <svg
      className="shrink-0 rounded-full"
      style={{ width: dimension, height: dimension }}
      viewBox="0 0 64 64"
      role="img"
      aria-label={name}
    >
      <circle cx="32" cy="32" r="31" fill={backgrounds[key]} />
      {avatarArt[key]}
    </svg>
  );
}
