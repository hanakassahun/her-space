"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type InviteCode = {
  code: string;
  uses: number;
  max_uses: number;
  active: boolean;
};

const RANDOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sanitizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
}

function generateRandomCode() {
  const prefix = Array.from({ length: 3 }, () => RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)]).join("");
  const suffix = Array.from({ length: 6 }, () => RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)]).join("");
  return `${prefix}-${suffix}`;
}

async function fetchInviteCodes() {
  return supabase
    .from("invite_codes")
    .select("code, uses, max_uses, active")
    .order("code", { ascending: true });
}

export default function AdminInvitesPage() {
  const router = useRouter();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [maxUsesInput, setMaxUsesInput] = useState("20");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingMaxUses, setEditingMaxUses] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadAdminInvites() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (adminError || !admin) {
        router.replace("/");
        return;
      }

      const { data, error } = await fetchInviteCodes();
      if (error) {
        setMessage(error.message);
      } else {
        setInviteCodes((data ?? []) as InviteCode[]);
      }
      setLoading(false);
    }

    void loadAdminInvites();
  }, [router]);

  async function refreshInviteCodes() {
    const { data, error } = await fetchInviteCodes();
    if (error) {
      setMessage(error.message);
      return;
    }
    setInviteCodes((data ?? []) as InviteCode[]);
  }

  async function toggleActive(invite: InviteCode) {
    if (invite.uses >= invite.max_uses) return;

    setBusyCode(invite.code);
    setMessage("");
    const { error } = await supabase
      .from("invite_codes")
      .update({ active: !invite.active })
      .eq("code", invite.code);

    if (error) {
      setMessage(error.message);
    } else {
      setInviteCodes((current) => current.map((item) =>
        item.code === invite.code ? { ...item, active: !item.active } : item
      ));
    }
    setBusyCode(null);
  }

  async function updateInviteMaxUses(invite: InviteCode) {
    const nextValue = Number(editingMaxUses[invite.code] ?? invite.max_uses);
    if (!Number.isFinite(nextValue) || nextValue < 1) {
      setMessage("Max uses must be at least 1.");
      return;
    }
    if (nextValue < invite.uses) {
      setMessage("Max uses cannot be lower than the current number of uses.");
      return;
    }

    setBusyCode(invite.code);
    setMessage("");
    const { error } = await supabase
      .from("invite_codes")
      .update({ max_uses: nextValue })
      .eq("code", invite.code);

    if (error) {
      setMessage(error.message);
    } else {
      setInviteCodes((current) => current.map((item) =>
        item.code === invite.code ? { ...item, max_uses: nextValue } : item
      ));
      setEditingMaxUses((current) => ({ ...current, [invite.code]: String(nextValue) }));
    }
    setBusyCode(null);
  }

  async function deleteInvite(invite: InviteCode) {
    const confirmed = window.confirm(`Delete invite code “${invite.code}”?`);
    if (!confirmed) return;

    setBusyCode(invite.code);
    setMessage("");
    const { error } = await supabase.from("invite_codes").delete().eq("code", invite.code);

    if (error) {
      setMessage(error.message);
    } else {
      setInviteCodes((current) => current.filter((item) => item.code !== invite.code));
    }
    setBusyCode(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const normalized = sanitizeCode(codeInput.trim());
    if (!/^[A-Z0-9-]{4,40}$/.test(normalized)) {
      setMessage("Invite codes must be 4 to 40 characters using letters, numbers, and hyphens only.");
      return;
    }

    const maxUses = Number(maxUsesInput);
    if (!Number.isFinite(maxUses) || maxUses < 1) {
      setMessage("Max uses must be at least 1.");
      return;
    }

    const { data: existing, error: lookupError } = await supabase
      .from("invite_codes")
      .select("code")
      .eq("code", normalized)
      .maybeSingle();

    if (lookupError) {
      setMessage(lookupError.message);
      return;
    }

    if (existing) {
      setMessage("That code already exists. Please try another one.");
      return;
    }

    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("invite_codes").insert({
      code: normalized,
      uses: 0,
      max_uses: maxUses,
      active: true,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setCodeInput("");
      setMaxUsesInput("20");
      setMessage("Invite code created.");
      await refreshInviteCodes();
    }
    setSaving(false);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 1200);
    } catch {
      setMessage("Unable to copy code to the clipboard.");
    }
  }

  return (
    <PageShell className="max-w-4xl space-y-8 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-deep-plum">Manage invite codes</h1>
      </header>

      <Card as="div" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">Create a code</h2>
        <form className="space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Code
              <Input
                value={codeInput}
                onChange={(event) => setCodeInput(sanitizeCode(event.target.value))}
                placeholder="HER-7K2M9Q"
                maxLength={40}
              />
            </label>
            <div className="flex items-end">
              <Button
                variant="secondary"
                type="button"
                className="min-h-11"
                onClick={() => setCodeInput(generateRandomCode())}
              >
                Generate random code
              </Button>
            </div>
          </div>

          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Max uses
            <Input
              type="number"
              min="1"
              value={maxUsesInput}
              onChange={(event) => setMaxUsesInput(event.target.value)}
            />
          </label>

          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create code"}
          </Button>
        </form>
      </Card>

      {message && <Card className="text-deep-plum" role="status">{message}</Card>}
      {loading && <p className="text-gray-700">Loading invite codes...</p>}
      {!loading && inviteCodes.length === 0 && <Card className="text-gray-700">No invite codes yet.</Card>}

      <section className="space-y-4" aria-label="Invite codes">
        {inviteCodes.map((invite) => {
          const status = invite.uses >= invite.max_uses ? "Used up" : invite.active ? "Active" : "Paused";
          const variant = invite.uses >= invite.max_uses ? "lilac" : invite.active ? "mint" : "rose";
          const isUsedUp = invite.uses >= invite.max_uses;

          return (
            <Card as="article" key={invite.code} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-semibold text-deep-plum">{invite.code}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-sm"
                    onClick={() => void copyCode(invite.code)}
                  >
                    {copiedCode === invite.code ? "Copied" : "Copy"}
                  </Button>
                </div>
                <Badge variant={variant}>{status}</Badge>
              </div>

              <p className="text-sm text-gray-700">
                {invite.uses} / {invite.max_uses}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant={invite.active ? "secondary" : "primary"}
                  onClick={() => void toggleActive(invite)}
                  disabled={busyCode === invite.code || isUsedUp}
                >
                  {invite.active ? "Pause" : "Activate"}
                </Button>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    className="w-24"
                    value={editingMaxUses[invite.code] ?? String(invite.max_uses)}
                    onChange={(event) =>
                      setEditingMaxUses((current) => ({
                        ...current,
                        [invite.code]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void updateInviteMaxUses(invite)}
                    disabled={busyCode === invite.code}
                  >
                    Edit max uses
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-800"
                  onClick={() => void deleteInvite(invite)}
                  disabled={busyCode === invite.code}
                >
                  Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </section>
    </PageShell>
  );
}
