"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/components/LanguageProvider";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <PageShell className="flex min-h-screen items-center justify-center">
      <Card as="section" className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-deep-plum">{t("forgot.title")}</h1>
        <p className="text-sm leading-6 text-gray-700">
          {t("forgot.intro")}
        </p>
        <form className="space-y-4" onSubmit={requestReset}>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            {t("login.email")}
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? t("forgot.sending") : t("forgot.send")}
          </Button>
        </form>
        {submitted && (
          <p className="rounded-2xl bg-soft-lilac/60 px-4 py-3 text-sm leading-6 text-deep-plum" role="status">
            {t("forgot.genericConfirmation")}
          </p>
        )}
        <Link className="text-sm font-medium text-deep-plum underline" href="/login">
          {t("forgot.backToLogin")}
        </Link>
      </Card>
    </PageShell>
  );
}