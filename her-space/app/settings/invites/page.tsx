"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

type InviteCode = { code: string; uses: number; max_uses: number; active: boolean };

export default function MemberInvitesPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const userId = user?.id ?? null;
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadCodes = useCallback(async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("invite_codes")
      .select("code, uses, max_uses, active")
      .eq("owner_id", currentUserId);
    if (error) {
      setMessage(friendlyError(error, t));
    } else {
      setCodes((data ?? []) as InviteCode[]);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }
    const timeout = window.setTimeout(() => void loadCodes(userId), 0);
    return () => window.clearTimeout(timeout);
  }, [authLoading, loadCodes, router, userId]);

  async function createCode() {
    if (creating) return;
    setCreating(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_my_invite");
    if (error) {
      setMessage(error.message.toLowerCase().includes("unlock") ? t("invite.mine.locked") : friendlyError(error, t));
      setCreating(false);
      return;
    }
    const code = typeof data === "string"
      ? data
      : data && typeof data === "object" && "code" in data && typeof data.code === "string"
        ? data.code
        : null;
    if (!code) {
      setMessage(friendlyError(new Error("The invite code could not be read."), t));
      setCreating(false);
      return;
    }
    setCodes((current) => [{ code, uses: 0, max_uses: 1, active: true }, ...current]);
    setCreating(false);
  }

  async function revokeCode(code: string) {
    if (busyCode) return;
    setBusyCode(code);
    setMessage("");
    const { error } = await supabase.rpc("revoke_my_invite", { p_code: code });
    if (error) setMessage(friendlyError(error, t));
    else setCodes((current) => current.map((item) => item.code === code ? { ...item, active: false } : item));
    setBusyCode(null);
  }

  async function copyCode(code: string) {
    setMessage("");
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => current === code ? null : current), 2000);
    } catch (error) {
      setMessage(friendlyError(error, t));
    }
  }

  return (
    <PageShell className="max-w-2xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-2">
        <h1 className="break-words text-3xl font-bold text-deep-plum">{t("invite.mine.title")}</h1>
        <p className="break-words leading-7 text-gray-700">{t("invite.mine.body")}</p>
      </header>
      <Button type="button" onClick={() => void createCode()} disabled={creating}>
        {t("invite.mine.create")}
      </Button>
      {message && <Card className="break-words text-red-700" role="alert"><FriendlyErrorMessage message={message} /></Card>}
      {loading && <p className="text-gray-700">{t("common.loading")}</p>}
      {!loading && codes.length === 0 && <Card className="text-gray-700">{t("invite.mine.body")}</Card>}
      <section className="space-y-3" aria-label={t("invite.mine.title")}>
        {codes.map((item) => {
          const status = !item.active
            ? t("invite.mine.cancelled")
            : item.uses > 0
              ? t("invite.mine.used")
              : t("invite.mine.unused");
          const unusedActive = item.active && item.uses === 0;
          return (
            <Card as="article" className="flex flex-wrap items-center justify-between gap-3" key={item.code}>
              <div className="min-w-0 space-y-2">
                <p className="break-all font-mono text-lg font-semibold text-deep-plum">{item.code}</p>
                <Badge variant={unusedActive ? "mint" : "lilac"}>{status}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => void copyCode(item.code)}>
                  {copiedCode === item.code ? t("invite.mine.copied") : t("invite.mine.copy")}
                </Button>
                {unusedActive && (
                  <Button type="button" variant="ghost" disabled={busyCode === item.code} onClick={() => void revokeCode(item.code)}>
                    {t("invite.mine.revoke")}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </section>
    </PageShell>
  );
}
