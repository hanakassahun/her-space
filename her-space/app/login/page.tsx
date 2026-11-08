"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/components/LanguageProvider";
import { maskEmail } from "@/lib/maskEmail";
import FloatingDots from "@/components/FloatingDots";

type RecentAccount = { email: string; name: string; ts: number };
const RECENT_ACCOUNTS_KEY = "recentAccounts";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>([]);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(RECENT_ACCOUNTS_KEY) ?? "[]") as unknown;
        if (Array.isArray(stored)) {
          setRecentAccounts(stored.filter((entry): entry is RecentAccount =>
            Boolean(entry)
            && typeof entry === "object"
            && "email" in entry && typeof entry.email === "string"
            && "name" in entry && typeof entry.name === "string"
            && "ts" in entry && typeof entry.ts === "number"
          ).slice(0, 3));
        }
      } catch {
        setRecentAccounts([]);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(friendlyError(error, t));
      setLoading(false);
      return;
    }

    if (rememberAccount && data.user) {
      const nameValue = data.user.user_metadata?.display_name;
      const account: RecentAccount = {
        email: data.user.email || email,
        name: typeof nameValue === "string" && nameValue.trim() ? nameValue.trim() : (data.user.email || email).split("@")[0],
        ts: Date.now(),
      };
      try {
        const previous = JSON.parse(window.localStorage.getItem(RECENT_ACCOUNTS_KEY) ?? "[]") as unknown;
        const accounts = Array.isArray(previous)
          ? previous.filter((entry): entry is RecentAccount =>
            Boolean(entry)
            && typeof entry === "object"
            && "email" in entry && typeof entry.email === "string"
            && "name" in entry && typeof entry.name === "string"
            && "ts" in entry && typeof entry.ts === "number"
          )
          : [];
        const updated = [account, ...accounts.filter((entry) => entry.email.toLowerCase() !== account.email.toLowerCase())].slice(0, 3);
        window.localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(updated));
        setRecentAccounts(updated);
      } catch {
        setMessage(friendlyError(new Error("Unable to save this account on the device."), t));
      }
    }

    router.push("/");
  }

  function removeRecentAccount(emailToRemove: string) {
    const updated = recentAccounts.filter((account) => account.email !== emailToRemove);
    setRecentAccounts(updated);
    try {
      if (updated.length === 0) window.localStorage.removeItem(RECENT_ACCOUNTS_KEY);
      else window.localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch (error) {
      setMessage(friendlyError(error, t));
    }
  }

  return (
    <PageShell className="relative flex min-h-screen items-center justify-center">
      <FloatingDots />
      <Card className="relative z-10 w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-deep-plum">{t("login.title")}</h1>
        {recentAccounts.length > 0 && (
          <section className="space-y-2" aria-labelledby="recent-accounts-heading">
            <h2 id="recent-accounts-heading" className="break-words text-sm font-semibold text-deep-plum">{t("login.recent")}</h2>
            <div className="flex flex-wrap gap-2">
              {recentAccounts.map((account) => (
                <div className="flex min-w-0 items-center rounded-full border border-soft-lilac bg-white/80 p-1" key={account.email}>
                  <button
                    className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full px-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      passwordRef.current?.focus();
                    }}
                  >
                    <span className="gradient-aurora inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" aria-hidden="true">
                      {account.name.trim().charAt(0).toLocaleUpperCase() || "H"}
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-deep-plum">{account.name}</span>
                      <span className="block break-all text-xs text-gray-600">{maskEmail(account.email)}</span>
                    </span>
                  </button>
                  <button
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-soft-lilac/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                    type="button"
                    aria-label={t("login.removeAccount")}
                    title={t("login.removeAccount")}
                    onClick={() => removeRecentAccount(account.email)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <p className="break-words text-xs leading-5 text-gray-600">{t("login.sharedWarning")}</p>
          </section>
        )}
        <Input
          type="email"
          placeholder={t("login.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          ref={passwordRef}
          type="password"
          placeholder={t("login.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="flex min-h-11 items-center gap-3 break-words text-sm text-gray-700">
          <input
            className="h-5 w-5 shrink-0 accent-[#8F72BE]"
            type="checkbox"
            checked={rememberAccount}
            onChange={(event) => setRememberAccount(event.target.checked)}
          />
          {t("login.remember")}
        </label>
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
        {message && <p className="text-red-700"><FriendlyErrorMessage message={message} /></p>}
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