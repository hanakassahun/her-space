"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { AVATAR_KEYS } from "@/components/Avatar";
import Avatar from "@/components/Avatar";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { maskEmail } from "@/lib/maskEmail";
import UsernameField, { useUsernameAvailability } from "@/components/UsernameField";
import { usernameErrorMessage } from "@/lib/username";

export default function EditProfilePage() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [usernameSaved, setUsernameSaved] = useState(false);
  const usernameAvailability = useUsernameAvailability(username, !loading && Boolean(user));

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (authLoading) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar, username")
        .eq("id", user.id)
        .single();
      if (!active) return;
      if (error) setMessage(friendlyError(error, t));
      else {
        setDisplayName(data.display_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setAvatar(data.avatar ?? null);
      }
      setLoading(false);
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, [authLoading, router, t, user]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving) return;
    const name = displayName.trim();
    if (name.length < 2 || name.length > 30) return;
    setSaving(true);
    setMessage("");
    setSaved(false);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, bio: bio.trim(), avatar })
      .eq("id", user.id);
    if (error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes("once every 30 days")) setMessage(t("profile.nameTooSoon"));
      else if (errorMessage.includes("not available")) setMessage(t("profile.nameReserved"));
      else setMessage(friendlyError(error, t));
    } else {
      setDisplayName(name);
      setBio(bio.trim());
      setSaved(true);
      setMessage(t("profile.saved"));
    }
    setSaving(false);
  }

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || usernameSaving || (usernameAvailability.status !== "ok" && usernameAvailability.status !== "yours")) return;
    setUsernameSaving(true);
    setUsernameMessage("");
    setUsernameSaved(false);
    try {
      const { error } = await supabase.rpc("set_username", { p_username: username });
      if (error) throw error;
      await refreshProfile();
      setUsernameSaved(true);
      setUsernameMessage(t("username.saved"));
    } catch (error) {
      setUsernameMessage(usernameErrorMessage(error, t));
    } finally {
      setUsernameSaving(false);
    }
  }

  if (loading) {
    return <PageShell className="max-w-2xl"><p className="text-gray-700">{t("common.loading")}</p></PageShell>;
  }

  return (
    <PageShell className="max-w-2xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header>
        <h1 className="text-3xl font-bold text-deep-plum">{t("profile.edit")}</h1>
      </header>
      <Card as="div">
        {user?.email && (
          <div className="mb-5 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all text-sm text-gray-800">{showEmail ? user.email : maskEmail(user.email)}</span>
              <Button type="button" variant="secondary" className="px-3" onClick={() => setShowEmail((current) => !current)}>
                {showEmail ? t("account.hide") : t("account.show")}
              </Button>
            </div>
            <p className="break-words text-xs text-gray-600">{t("account.emailHidden")}</p>
          </div>
        )}
        <form className="space-y-5" onSubmit={saveProfile}>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-deep-plum">{t("profile.avatar")}</legend>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {AVATAR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`flex min-h-14 min-w-14 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${avatar === key ? "ring-2 ring-[#8F72BE] ring-offset-2" : ""}`}
                  aria-label={key}
                  aria-pressed={avatar === key}
                  onClick={() => setAvatar(key)}
                >
                  <Avatar name={displayName || "Her Space member"} avatar={key} size={48} />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            {t("signup.displayName")}
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={30}
              required
            />
            <span className="block break-words text-xs font-normal text-gray-600">{t("profile.nameRule")}</span>
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            {t("profile.editBio")}
            <Textarea className="min-h-28" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} />
            <span className="block text-right text-xs font-normal text-gray-600">{bio.length}/160</span>
          </label>
          {message && (
            <p className={`break-words text-sm ${saved ? "text-emerald-800" : "text-red-700"}`} role={saved ? "status" : "alert"}>
              <FriendlyErrorMessage message={message} />
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving || displayName.trim().length < 2 || displayName.trim().length > 30}>
              {saving ? t("reset.saving") : t("common.saveChanges")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push(`/u/${user?.id}`)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
        <form className="mt-6 space-y-4 border-t border-soft-lilac/70 pt-5" onSubmit={saveUsername}>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-deep-plum">{t("username.label")}</h2>
            <p className="break-words text-sm text-gray-500">@{username}</p>
          </div>
          <UsernameField
            id="profile-username"
            value={username}
            onChange={(next) => {
              setUsername(next);
              setUsernameMessage("");
              setUsernameSaved(false);
            }}
            status={usernameAvailability.status}
            error={usernameAvailability.error}
            hint={t("username.change")}
            disabled={usernameSaving}
          />
          {usernameMessage && (
            <p className={`break-words text-sm ${usernameSaved ? "text-emerald-800" : "text-red-700"}`} role={usernameSaved ? "status" : "alert"}>
              <FriendlyErrorMessage message={usernameMessage} />
            </p>
          )}
          <Button
            type="submit"
            disabled={usernameSaving || (usernameAvailability.status !== "ok" && usernameAvailability.status !== "yours")}
          >
            {usernameSaving ? t("reset.saving") : t("common.saveChanges")}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
