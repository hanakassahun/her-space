"use client";

import { useState } from "react";

type LikeButtonProps = {
  count: number;
  liked: boolean;
  onToggle: () => Promise<void>;
};

export default function LikeButton({ count, liked, onToggle }: LikeButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    await onToggle();
    setLoading(false);
  }

  return (
    <button
      className={`rounded px-3 py-1.5 text-sm disabled:opacity-50 ${
        liked
          ? "bg-rose-100 text-rose-800"
          : "border border-rose-300 bg-white text-rose-700"
      }`}
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-pressed={liked}
      aria-label={`${liked ? "Unlike" : "Like"} post, ${count} likes`}
    >
      {liked ? "Liked" : "Like"} · {count}
    </button>
  );
}