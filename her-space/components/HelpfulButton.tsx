"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";

type HelpfulButtonProps = {
  initialCount: number;
  initialMarked: boolean;
} & (
  | { postId: string; articleId?: never }
  | { postId?: never; articleId: string }
);

export default function HelpfulButton({
  postId,
  articleId,
  initialCount,
  initialMarked,
}: HelpfulButtonProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [count, setCount] = useState(initialCount);
  const [marked, setMarked] = useState(initialMarked);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);

  async function toggleHelpful() {
    const targetId = postId ?? articleId;
    if (inFlight.current || !user || !targetId) return;

    inFlight.current = true;
    setLoading(true);
    setMessage("");
    const previousCount = count;
    const previousMarked = marked;
    setCount(previousCount + (previousMarked ? -1 : 1));
    setMarked(!previousMarked);

    try {
      const result = previousMarked
        ? await supabase
            .from("helpful_marks")
            .delete()
            .eq("user_id", user.id)
            .eq(postId ? "post_id" : "article_id", targetId)
        : await supabase.from("helpful_marks").insert(
            postId ? { post_id: postId } : { article_id: targetId }
          );
      if (result.error) throw result.error;
    } catch (error) {
      setCount(previousCount);
      setMarked(previousMarked);
      setMessage(friendlyError(error, t));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle disabled:cursor-not-allowed disabled:opacity-60 ${
          marked
            ? "border-soft-lilac bg-soft-lilac/70 text-deep-plum"
            : "border-[#CDBDEB] bg-white/70 text-gray-700 hover:bg-soft-lilac/30"
        }`}
        type="button"
        onClick={() => void toggleHelpful()}
        disabled={loading || !user}
        aria-pressed={marked}
      >
        <svg
          className="h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 21V11" />
          <path d="M12 15c-5.5 0-8-3.5-8-8 4.5 0 8 2.5 8 8Z" />
          <path d="M12 12c0-4.5 2.5-7 7-7 0 4.5-2.5 7-7 7Z" />
        </svg>
        <span className="break-words">{t(marked ? "helpful.marked" : "helpful.button")}</span>
      </button>
      {count > 0 && (
        <p className="break-words text-xs text-gray-500">
          {count} {t("helpful.countLabel")}
        </p>
      )}
      {message && <p className="break-words text-sm text-red-700" role="alert">{message}</p>}
    </div>
  );
}
