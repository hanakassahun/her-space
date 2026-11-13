"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { usernameErrorMessage } from "@/lib/username";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import UsernameField, { useUsernameAvailability } from "@/components/UsernameField";

const snoozeKey = "usernamePromptSnooze";
const excludedPaths = new Set([
  "/login",
  "/signup",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
]);

function localDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function UsernamePrompt({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, username, usernameConfirmed, refreshProfile } = useAuth();
  const [snooze, setSnooze] = useState<{ userId: string; date: string } | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const userId = user?.id ?? null;
  const routeEnabled = enabled && !excludedPaths.has(pathname);
  const availability = useUsernameAvailability(
    value,
    Boolean(routeEnabled && user && usernameConfirmed === false && !saved)
  );
  const snoozeLoaded = Boolean(userId && snooze?.userId === userId);
  const shouldShow = Boolean(
    routeEnabled
    && user
    && ((usernameConfirmed === false && snoozeLoaded && snooze?.date !== localDateString()) || saved)
  );

  useEffect(() => {
    if (!userId) return;
    const timeout = window.setTimeout(() => {
      let date = "";
      try {
        date = window.localStorage.getItem(snoozeKey) ?? "";
      } catch {
        date = "";
      }
      setSnooze({ userId, date });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [userId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setValue(username?.toLowerCase() ?? ""), 0);
    return () => window.clearTimeout(timeout);
  }, [username]);

  useEffect(() => {
    if (!saved || usernameConfirmed !== true) return;
    const timeout = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [saved, usernameConfirmed]);

  async function saveUsername() {
    if (!user || saving || (availability.status !== "ok" && availability.status !== "yours")) return;
    setSaving(true);
    setSubmitError("");
    setSaved(false);
    try {
      const { error } = await supabase.rpc("set_username", { p_username: value });
      if (error) throw error;
      setSaved(true);
      await refreshProfile();
    } catch (error) {
      setSubmitError(usernameErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  function dismissForToday() {
    if (!user) return;
    const date = localDateString();
    try {
      window.localStorage.setItem(snoozeKey, date);
    } catch {
      // Keep the prompt dismissed for this page view if storage is unavailable.
    }
    setSnooze({ userId: user.id, date });
    setSaved(false);
  }

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-deep-plum/35 p-4" role="presentation">
      <Card
        as="div"
        className="my-auto w-full max-w-lg space-y-4 bg-white/95 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-prompt-title"
      >
        <div className="space-y-2">
          <h2 id="username-prompt-title" className="break-words text-xl font-semibold text-deep-plum">{t("username.promptTitle")}</h2>
          <p className="break-words text-sm leading-6 text-gray-700">{t("username.promptBody")}</p>
        </div>
        <UsernameField
          id="username-prompt"
          value={value}
          onChange={(next) => {
            setValue(next);
            setSubmitError("");
            setSaved(false);
          }}
          status={availability.status}
          error={availability.error}
          disabled={saving || saved}
        />
        {submitError && <p className="break-words text-sm text-red-700" role="alert">{submitError}</p>}
        {saved && <p className="break-words text-sm text-emerald-800" role="status">{t("username.saved")}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={saving || saved || (availability.status !== "ok" && availability.status !== "yours")}
            onClick={() => void saveUsername()}
          >
            {saving ? t("reset.saving") : t("username.use")}
          </Button>
          <Button variant="secondary" type="button" onClick={dismissForToday}>
            {t("remind.dismiss")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
