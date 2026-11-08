"use client";

export default function DecorativeEmptyArt({ variant = "cloud" }: { variant?: "cloud" | "sprout" | "moon" }) {
  return (
    <svg className="mb-3 h-24 w-24" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      {variant === "cloud" && (
        <>
          <path d="M22 60h49a14 14 0 0 0 0-28 21 21 0 0 0-40-4 16 16 0 0 0-9 32Z" fill="#d9c9f3" />
          <path d="M29 64c8 5 29 6 39 1" fill="none" stroke="#b9c8f5" strokeLinecap="round" strokeWidth="5" />
          <circle cx="27" cy="72" r="4" fill="#f2c8dc" />
        </>
      )}
      {variant === "sprout" && (
        <>
          <path d="M48 77V43" fill="none" stroke="#688f68" strokeLinecap="round" strokeWidth="5" />
          <path d="M48 55C25 55 19 41 20 24c17 0 28 8 28 31Zm0-14c0-22 12-33 31-32 0 19-9 31-31 32Z" fill="#b9d7b1" />
          <path d="M23 79h49" fill="none" stroke="#d9c9f3" strokeLinecap="round" strokeWidth="5" />
        </>
      )}
      {variant === "moon" && (
        <>
          <path d="M62 15a34 34 0 1 0 20 58A34 34 0 0 1 62 15Z" fill="#d9c9f3" />
          <circle cx="27" cy="29" r="4" fill="#f2c8dc" />
          <circle cx="69" cy="26" r="3" fill="#b9c8f5" />
        </>
      )}
    </svg>
  );
}
