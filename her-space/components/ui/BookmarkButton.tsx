"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";

type BookmarkButtonProps = {
  saved: boolean;
  disabled?: boolean;
  saveLabel: string;
  savedLabel: string;
  onToggle: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export default function BookmarkButton({
  saved,
  disabled = false,
  saveLabel,
  savedLabel,
  onToggle,
  className = "",
  variant = "ghost",
}: BookmarkButtonProps) {
  const iconRef = useRef<SVGSVGElement>(null);
  const previousSaved = useRef(saved);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      previousSaved.current = saved;
      return;
    }
    const icon = iconRef.current;
    if (icon && saved && !previousSaved.current) {
      icon.classList.remove("bookmark-bounce");
      window.requestAnimationFrame(() => icon.classList.add("bookmark-bounce"));
      const timeout = window.setTimeout(() => icon.classList.remove("bookmark-bounce"), 250);
      previousSaved.current = saved;
      return () => window.clearTimeout(timeout);
    }
    previousSaved.current = saved;
  }, [saved]);

  return (
    <Button
      variant={variant}
      className={`!h-11 !w-11 !min-w-11 !px-0 !py-0 text-deep-plum ${className}`}
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={saved ? savedLabel : saveLabel}
      aria-pressed={saved}
      title={saved ? savedLabel : saveLabel}
    >
      <svg ref={iconRef} className="h-5 w-5" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z" />
      </svg>
    </Button>
  );
}