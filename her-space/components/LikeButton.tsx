"use client";

import { useEffect, useRef, useState } from "react";
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
  const inFlight = useRef(false);
  const heartRef = useRef<SVGSVGElement>(null);
  const previousLiked = useRef(liked);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      previousLiked.current = liked;
      return;
    }
    const heart = heartRef.current;
    if (heart && liked && !previousLiked.current) {
      heart.classList.remove("heart-pop");
      window.requestAnimationFrame(() => heart.classList.add("heart-pop"));
      const timeout = window.setTimeout(() => heart.classList.remove("heart-pop"), 250);
      previousLiked.current = liked;
      return () => window.clearTimeout(timeout);
    }
    previousLiked.current = liked;
  }, [liked]);

  async function handleClick() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      await onToggle();
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
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
          ref={heartRef}
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