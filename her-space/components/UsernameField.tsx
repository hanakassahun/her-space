"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import Input from "@/components/ui/Input";
import { sanitizeUsername, type UsernameAvailability } from "@/lib/username";

type AvailabilityResult = {
  userId: string;
  username: string;
  status: UsernameAvailability | "error";
  error: string;
};

export function useUsernameAvailability(username: string, enabled = true) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled || !userId) return;
    const currentRequestId = ++requestId.current;
    let active = true;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase.rpc("username_available", { p_username: username });
          if (error) throw error;
          if (!isAvailability(data)) throw new Error("Unexpected username availability response.");
          if (active && requestId.current === currentRequestId) {
            setResult({ userId, username, status: data, error: "" });
          }
        } catch (error) {
          if (active && requestId.current === currentRequestId) {
            setResult({ userId, username, status: "error", error: friendlyError(error, t) });
          }
        }
      })();
    }, 400);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [enabled, t, userId, username]);

  const currentResult = result?.userId === userId && result.username === username ? result : null;
  const status: AvailabilityResult["status"] | "checking" = currentResult?.status ?? "checking";
  return {
    status,
    error: currentResult?.error ?? "",
  };
}

function isAvailability(value: unknown): value is UsernameAvailability {
  return value === "ok" || value === "yours" || value === "taken" || value === "reserved" || value === "invalid";
}

export default function UsernameField({
  id,
  value,
  onChange,
  status,
  error,
  hint,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  status: UsernameAvailability | "checking" | "error";
  error: string;
  hint?: string;
  disabled?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-2">
      <label className="block space-y-2 text-sm font-medium text-deep-plum" htmlFor={id}>
        {t("username.label")}
        <Input
          id={id}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          value={value}
          disabled={disabled}
          aria-describedby={`${id}-preview ${id}-rules ${id}-status`}
          onChange={(event) => onChange(sanitizeUsername(event.target.value))}
        />
      </label>
      <p id={`${id}-preview`} className="break-words text-sm text-gray-500" aria-live="polite">@{value}</p>
      <p id={`${id}-rules`} className="break-words text-sm leading-6 text-gray-600">{t("username.rules")}</p>
      {hint && <p className="break-words text-sm leading-6 text-gray-600">{hint}</p>}
      <p
        id={`${id}-status`}
        className={`break-words text-sm ${error ? "text-red-700" : status === "ok" || status === "yours" ? "text-emerald-800" : "text-gray-600"}`}
        role={error || status === "error" ? "alert" : "status"}
      >
        {error ? <FriendlyErrorMessage message={error} /> : t(`username.${status === "error" ? "checking" : status}`)}
      </p>
    </div>
  );
}
