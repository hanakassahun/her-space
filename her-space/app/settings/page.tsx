"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";

type BlockRow = {
  blocked_id: string;
  kind: "mute" | "block";
  created_at: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

function getDisplayName(profiles: BlockRow["profiles"]): string {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p?.display_name ?? "Her Space member";
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [blockRows, setBlockRows] = useState<BlockRow[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      if (authLoading) return;
      if (!userId) {
        router.replace("/login");
        return;
      }

      const { data: rows } = await supabase
        .from("user_blocks")
        .select(
          "blocked_id, kind, created_at, profiles!user_blocks_blocked_id_fkey(display_name)"
        )
        .order("created_at", { ascending: false });

      setBlockRows((rows ?? []) as BlockRow[]);
      setLoading(false);
    }
    void checkSession();
  }, [authLoading, router, userId]);

  async function logOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function deleteAccount() {
    if (confirmation !== "DELETE" || deleting) return;

    setDeleting(true);
    setMessage("");
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setMessage(friendlyError(error, t));
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/");
  }

  async function removeBlock(blockedId: string) {
    if (removingId) return;
    setRemovingId(blockedId);
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocked_id", blockedId);
    if (!error) {
      setBlockRows((current) => current.filter((r) => r.blocked_id !== blockedId));
    }
    setRemovingId(null);
  }

  if (loading) {
    return (
      <PageShell className="max-w-2xl">
        <p className="text-gray-700">Loading settings...</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-2xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header>
        <h1 className="text-3xl font-bold text-deep-plum">Settings</h1>
        <p className="mt-2 text-gray-700">Account and community information.</p>
      </header>

      <Card as="section" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">Community information</h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link className="text-deep-plum underline" href="/rules">Community rules</Link>
          <Link className="text-deep-plum underline" href="/privacy">Privacy</Link>
          <Link className="text-deep-plum underline" href="/terms">Terms</Link>
        </div>
      </Card>

      <Card as="section" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">Feedback</h2>
        <p className="text-sm text-gray-700">Tell us what&apos;s working or what could be better.</p>
        <Link
          href="/feedback"
          className="inline-flex min-h-[44px] items-center rounded-full border border-[#CDBDEB] bg-white px-4 text-sm font-medium text-deep-plum transition hover:bg-soft-lilac/20"
        >
          Send feedback
        </Link>
      </Card>

      {/* Muted and blocked members */}
      <Card as="section" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">{t("safety.listTitle")}</h2>
        {blockRows.length === 0 ? (
          <p className="text-sm text-gray-600">{t("safety.listEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {blockRows.map((row) => (
              <li
                key={row.blocked_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#CDBDEB] bg-white px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/u/${row.blocked_id}`}
                    className="font-medium text-deep-plum underline"
                  >
                    {getDisplayName(row.profiles)}
                  </Link>
                  <Badge variant={row.kind === "block" ? "rose" : "lilac"}>
                    {t(row.kind === "block" ? "safety.blockedLabel" : "safety.mutedLabel")}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  type="button"
                  className="text-sm"
                  disabled={removingId === row.blocked_id}
                  onClick={() => void removeBlock(row.blocked_id)}
                >
                  {row.kind === "block" ? t("safety.unblock") : t("safety.unmute")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-deep-plum">Sign out</h2>
          <p className="mt-1 text-sm text-gray-700">Sign out of Her Space on this device.</p>
        </div>
        <Button variant="secondary" type="button" onClick={logOut}>Log out</Button>
      </Card>

      <Card as="section" className="space-y-4 border border-rose-200 bg-rose-50/75">
        <div>
          <h2 className="text-xl font-semibold text-rose-950">Delete my account</h2>
          <p className="mt-2 text-sm leading-6 text-rose-950">
            This permanently deletes your account and removes all your posts, comments, journal entries, and saves. This action cannot be undone.
          </p>
        </div>
        <label className="block space-y-2 text-sm font-medium text-rose-950">
          Type DELETE to confirm
          <Input
            className="border-rose-200 bg-white"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="DELETE"
          />
        </label>
        {message && <p className="text-sm font-medium text-red-800" role="alert">{message}</p>}
        <Button
          className="bg-rose-800 text-white shadow-none"
          type="button"
          disabled={confirmation !== "DELETE" || deleting}
          onClick={deleteAccount}
        >
          {deleting ? "Deleting account..." : "Permanently delete account"}
        </Button>
      </Card>
    </PageShell>
  );
}