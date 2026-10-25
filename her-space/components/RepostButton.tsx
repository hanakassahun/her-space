"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

type RepostButtonProps = {
  postId: string;
  authorId: string;
  allowReposts: boolean;
  initiallyShared: boolean;
};

export default function RepostButton({ postId, authorId, allowReposts, initiallyShared }: RepostButtonProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [shared, setShared] = useState(initiallyShared);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const inFlight = useRef(false);
  const messageTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShared(initiallyShared);
  }, [initiallyShared]);

  useEffect(() => () => {
    if (messageTimeout.current) clearTimeout(messageTimeout.current);
  }, []);

  if (!user || !allowReposts || authorId === user.id) return null;

  async function toggleRepost() {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setHasError(false);
    const previous = shared;
    setShared(!previous);

    try {
      const result = previous
        ? await supabase.from("reposts").delete().eq("post_id", postId).eq("user_id", user.id)
        : await supabase.from("reposts").insert({ post_id: postId });
      if (result.error) throw result.error;
      if (!previous) {
        setMessage(t("repost.done"));
        if (messageTimeout.current) clearTimeout(messageTimeout.current);
        messageTimeout.current = setTimeout(() => setMessage(""), 2500);
      }
    } catch (error) {
      setShared(previous);
      setHasError(true);
      setMessage(friendlyError(error, t));
      if (messageTimeout.current) clearTimeout(messageTimeout.current);
      messageTimeout.current = setTimeout(() => setMessage(""), 3500);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const label = t(shared ? "repost.undo" : "repost.button");

  return (
    <span className="inline-flex min-w-11 items-center gap-1">
      <button
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-soft-lilac/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle disabled:opacity-50 ${shared ? "text-deep-plum" : "text-gray-600"}`}
        type="button"
        disabled={busy}
        aria-label={label}
        title={label}
        aria-pressed={shared}
        onClick={() => void toggleRepost()}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={shared ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 3l5 5h-4v3h-2V8H6v3H4V6h12zM8 21l-5-5h4v-3h2v3h9v-3h2v5H8z" />
        </svg>
      </button>
      {message && <span className={`max-w-40 break-words text-xs ${hasError ? "text-red-700" : "text-emerald-800"}`} role={hasError ? "alert" : "status"}>{message}</span>}
    </span>
  );
}
