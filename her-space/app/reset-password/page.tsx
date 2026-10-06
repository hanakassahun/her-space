"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/components/LanguageProvider";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasRecoverySession(true);
      setCheckingSession(false);
    });

    const timeout = window.setTimeout(() => setCheckingSession(false), 1500);
    return () => {
      window.clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasRecoverySession || saving) return;
    if (password.length < 8) {
      setMessage(t("reset.minLength"));
      return;
    }
    if (password !== confirmPassword) {
      setMessage(t("reset.noMatch"));
      return;
    }

    setSaving(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }
    router.replace("/");
  }

  return (
    <PageShell className="flex min-h-screen items-center justify-center">
      <Card as="section" className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-deep-plum">{t("reset.title")}</h1>
        {checkingSession ? (
          <p className="text-sm text-gray-700">{t("reset.checking")}</p>
        ) : !hasRecoverySession ? (
          <>
            <p className="text-sm leading-6 text-gray-700">
              {t("reset.missingSession")}
            </p>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full gradient-aurora px-5 py-2 text-sm font-semibold text-white" href="/forgot-password">
              {t("reset.requestNew")}
            </Link>
          </>
        ) : (
          <form className="space-y-4" onSubmit={saveNewPassword}>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              {t("reset.newPassword")}
              <Input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              {t("reset.confirmPassword")}
              <Input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
            {message && <p className="text-sm text-red-700" role="alert">{message}</p>}
            <Button className="w-full" type="submit" disabled={saving || password.length < 8 || password !== confirmPassword}>
              {saving ? t("reset.saving") : t("reset.update")}
            </Button>
          </form>
        )}
      </Card>
    </PageShell>
  );
}