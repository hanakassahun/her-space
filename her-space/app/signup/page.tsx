"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/components/LanguageProvider";

export default function SignupPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!agreedToPolicies) return;
    setLoading(true);
    setMessage("");

    const trimmedInviteCode = inviteCode.trim();
    const { data: inviteIsValid, error: inviteError } = await supabase.rpc(
      "is_invite_code_valid",
      { p_code: trimmedInviteCode }
    );
    if (inviteError) {
      setMessage(inviteError.message);
      setLoading(false);
      return;
    }
    if (!inviteIsValid) {
      setMessage(t("signup.invalidInvite"));
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      const signupMessage = error?.message ?? "Something went wrong.";
      setMessage(
        signupMessage.toLowerCase().includes("you can only request this after")
          ? t("signup.rateLimit")
          : signupMessage
      );
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: data.user.id, display_name: displayName });

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    await supabase.rpc("redeem_invite_code", { p_code: trimmedInviteCode });
    router.push("/");
  }

  return (
    <PageShell className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-deep-plum">{t("signup.title")}</h1>
        <p className="text-deep-plum">
          {t("signup.intro")}
        </p>
        <Input
          placeholder={t("signup.inviteCode")}
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
        <Input
          placeholder={t("signup.displayName")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Input
          type="email"
          placeholder={t("login.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder={t("signup.passwordHint")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="flex items-start gap-3 text-sm leading-6 text-gray-700">
          <input
            className="mt-1 h-4 w-4 shrink-0 accent-fuchsia-700"
            type="checkbox"
            required
            checked={agreedToPolicies}
            onChange={(event) => setAgreedToPolicies(event.target.checked)}
          />
          <span>
            {t("signup.agree")} {" "}
            <Link className="font-medium text-deep-plum underline" href="/rules" target="_blank" rel="noopener noreferrer">{t("legal.rules")}</Link>,{" "}
            <Link className="font-medium text-deep-plum underline" href="/privacy" target="_blank" rel="noopener noreferrer">{t("legal.privacy")}</Link>{" "}
            {t("signup.and")} {" "}
            <Link className="font-medium text-deep-plum underline" href="/terms" target="_blank" rel="noopener noreferrer">{t("legal.terms")}</Link>.
          </span>
        </label>
        <Button
          className="w-full"
          onClick={handleSignup}
          disabled={loading || !agreedToPolicies}
        >
          {loading ? t("signup.creating") : t("signup.create")}
        </Button>
        {message && <p className="text-red-700">{message}</p>}
      </Card>
    </PageShell>
  );
}