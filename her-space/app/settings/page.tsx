"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/components/LanguageProvider";

export default function SettingsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setLoading(false);
    }
    void checkSession();
  }, [router]);

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