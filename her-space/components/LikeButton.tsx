"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/components/LanguageProvider";

type LikeButtonProps = {
  count: number;
  liked: boolean;
  onToggle: () => Promise<void>;
};

export default function LikeButton({ count, liked, onToggle }: LikeButtonProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    await onToggle();
    setLoading(false);
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm text-deep-plum">
      <Button
        className="!h-11 !w-11 !min-w-11 !px-0 !py-0 text-rose-700 hover:bg-rose-50"
        variant="ghost"
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-pressed={liked}
        aria-label={`${t(liked ? "like.unlike" : "like.like")} ${count} ${t("like.likes")}`}
        title={t(liked ? "like.unlike" : "like.like")}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M20.8 8.8c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />
        </svg>
      </Button>
      <span aria-label={`${count} ${t("like.likes")}`}>{count}</span>
    </span>
  );
}