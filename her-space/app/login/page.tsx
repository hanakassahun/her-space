"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/components/LanguageProvider";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(friendlyError(error, t));
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <PageShell className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-deep-plum">{t("login.title")}</h1>
        <Input
          type="email"
          placeholder={t("login.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder={t("login.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          className="w-full"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? t("login.signingIn") : t("home.login")}
        </Button>
        <Link
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-soft-lilac bg-white/70 px-4 text-sm font-semibold text-deep-plum underline underline-offset-4 hover:bg-soft-lilac/40"
          href="/forgot-password"
        >
          {t("login.forgot")}
        </Link>
        {message && <p className="text-red-700">{message}</p>}
        <p className="text-deep-plum">
          {t("login.newHere")} {" "}
          <a className="underline" href="/signup">
            {t("login.createAccount")}
          </a>
        </p>
      </Card>
    </PageShell>
  );
}