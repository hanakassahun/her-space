"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";
import InterestPicker from "@/components/InterestPicker";
import { maskEmail } from "@/lib/maskEmail";

const RECENT_ACCOUNTS_KEY = "recentAccounts";

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
  const {
    user,
    loading: authLoading,
    quietMode,
    quietModeSaving,
    quietModeError,
    setQuietMode,
    remindLog,
    remindLogSaving,
    remindLogError,
    setRemindLog,
    remindPeriod,
    remindPeriodSaving,
    remindPeriodError,
    setRemindPeriod,
    notificationPrefs,
    notificationsPausedUntil,
    notificationPrefsSaving,
    notificationPrefsError,
    setNotificationPreference,
  } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [blockRows, setBlockRows] = useState<BlockRow[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<"teen" | "adult" | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [savedInterests, setSavedInterests] = useState<string[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);
  const [interestMessage, setInterestMessage] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [recentAccountsMessage, setRecentAccountsMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    async function checkSession() {
      if (authLoading) return;
      if (!userId) {
        router.replace("/login");
        return;
      }

      const [blocksResult, interestsResult, privateResult] = await Promise.all([
        supabase
          .from("user_blocks")
          .select("blocked_id, kind, created_at, profiles!user_blocks_blocked_id_fkey(display_name)")
          .order("created_at", { ascending: false }),
        supabase.from("member_interests").select("topic").eq("user_id", userId).order("topic"),
        supabase.from("member_private").select("age_group").eq("user_id", userId).maybeSingle(),
      ]);

      setBlockRows((blocksResult.data ?? []) as BlockRow[]);
      const interests = ((interestsResult.data ?? []) as { topic: string }[]).map(({ topic }) => topic.toLowerCase());
      setSelectedInterests(interests);
      setSavedInterests(interests);
      setAgeGroup(privateResult.data?.age_group === "teen" || privateResult.data?.age_group === "adult" ? privateResult.data.age_group : null);
      if (interestsResult.error) setInterestMessage(friendlyError(interestsResult.error, t));
      else if (privateResult.error) setInterestMessage(friendlyError(privateResult.error, t));
      setLoading(false);
    }
    void checkSession();
  }, [authLoading, router, t, userId]);

  async function saveInterests() {
    if (!userId || savingInterests) return;
    const nextInterests = [...new Set(selectedInterests.map((topic) => topic.toLowerCase()))].slice(0, 6);
    const removed = savedInterests.filter((topic) => !nextInterests.includes(topic));
    const added = nextInterests.filter((topic) => !savedInterests.includes(topic));
    setSavingInterests(true);
    setInterestMessage("");

    if (removed.length > 0) {
      const { error } = await supabase
        .from("member_interests")
        .delete()
        .eq("user_id", userId)
        .in("topic", removed);
      if (error) {
        setInterestMessage(friendlyError(error, t));
        setSavingInterests(false);
        return;
      }
      setSavedInterests((current) => current.filter((topic) => !removed.includes(topic)));
    }

    if (added.length > 0) {
      const { error } = await supabase
        .from("member_interests")
        .insert(added.map((topic) => ({ user_id: userId, topic })));
      if (error) {
        setInterestMessage(friendlyError(error, t));
        setSavingInterests(false);
        return;
      }
    }

    setSelectedInterests(nextInterests);
    setSavedInterests(nextInterests);
    setInterestMessage(t("settings.interestsSaved"));
    setSavingInterests(false);
  }

  async function resetInterests() {
    if (!userId || savingInterests || !window.confirm(t("settings.interestsResetConfirm"))) return;
    setSavingInterests(true);
    setInterestMessage("");
    const { error } = await supabase.from("member_interests").delete().eq("user_id", userId);
    if (error) {
      setInterestMessage(friendlyError(error, t));
    } else {
      setSelectedInterests([]);
      setSavedInterests([]);
      setInterestMessage(t("settings.interestsSaved"));
    }
    setSavingInterests(false);
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  function forgetAllAccounts() {
    setRecentAccountsMessage("");
    try {
      window.localStorage.removeItem(RECENT_ACCOUNTS_KEY);
    } catch (error) {
      setRecentAccountsMessage(friendlyError(error, t));
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordSaving) return;
    if (newPassword.length < 8) {
      setPasswordMessage(t("reset.minLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage(t("reset.noMatch"));
      return;
    }
    setPasswordSaving(true);
    setPasswordMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPasswordMessage(friendlyError(error, t));
    else {
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(t("account.passwordChanged"));
    }
    setPasswordSaving(false);
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

      <Card as="section" className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-deep-plum">{t("quiet.title")}</h2>
            <p className="mt-1 break-words text-sm leading-6 text-gray-700">{t("quiet.hint")}</p>
          </div>
          <button
            className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${quietMode ? "gradient-aurora border-transparent" : "border-[#CDBDEB] bg-soft-lilac/40"}`}
            type="button"
            role="switch"
            aria-label={t("quiet.title")}
            aria-checked={quietMode}
            disabled={quietModeSaving}
            onClick={() => void setQuietMode(!quietMode)}
          >
            <span className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${quietMode ? "translate-x-7" : "translate-x-0"}`} />
          </button>
        </div>
        {quietModeError && <p className="break-words text-sm text-red-700" role="alert">{quietModeError}</p>}
      </Card>

      <Card as="section" className="space-y-4">
        <h2 className="break-words text-xl font-semibold text-deep-plum">{t("notif.settingsTitle")}</h2>
        {([
          ["notif_comments", "notif.setComments"],
          ["notif_follows", "notif.setFollows"],
          ["notif_shares", "notif.setShares"],
          ["notif_milestones", "notif.setMilestones"],
        ] as const).map(([key, label]) => (
          <div className="flex items-start justify-between gap-4 border-t border-soft-lilac/70 pt-4" key={key}>
            <p className="min-w-0 break-words font-medium text-deep-plum">{t(label)}</p>
            <button
              className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${notificationPrefs[key] ? "gradient-aurora border-transparent" : "border-[#CDBDEB] bg-soft-lilac/40"}`}
              type="button"
              role="switch"
              aria-label={t(label)}
              aria-checked={notificationPrefs[key]}
              disabled={notificationPrefsSaving}
              onClick={() => void setNotificationPreference(key, !notificationPrefs[key])}
            >
              <span className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${notificationPrefs[key] ? "translate-x-7" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
        <p className="break-words text-sm leading-6 text-gray-600">{t("notif.moderationAlways")}</p>
        {notificationsPausedUntil && (
          <p className="break-words text-sm text-gray-600">
            {t("notif.pausedUntil")} <time dateTime={notificationsPausedUntil}>{new Date(notificationsPausedUntil).toLocaleString()}</time>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            type="button"
            disabled={notificationPrefsSaving}
            onClick={() => void setNotificationPreference("notifications_paused_until", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())}
          >
            {t("notif.pause1d")}
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={notificationPrefsSaving}
            onClick={() => void setNotificationPreference("notifications_paused_until", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())}
          >
            {t("notif.pause7d")}
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={notificationPrefsSaving || !notificationsPausedUntil}
            onClick={() => void setNotificationPreference("notifications_paused_until", null)}
          >
            {t("notif.resume")}
          </Button>
        </div>
        {notificationPrefsError && <p className="break-words text-sm text-red-700" role="alert">{notificationPrefsError}</p>}
      </Card>

      <Card as="section" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">{t("remind.title")}</h2>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p id="remind-log-label" className="break-words font-medium text-deep-plum">{t("remind.log")}</p>
            <p className="mt-1 break-words text-sm leading-6 text-gray-700">{t("remind.logHint")}</p>
          </div>
          <button
            className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${remindLog ? "gradient-aurora border-transparent" : "border-[#CDBDEB] bg-soft-lilac/40"}`}
            type="button"
            role="switch"
            aria-labelledby="remind-log-label"
            aria-checked={remindLog}
            disabled={remindLogSaving}
            onClick={() => void setRemindLog(!remindLog)}
          >
            <span className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${remindLog ? "translate-x-7" : "translate-x-0"}`} />
          </button>
        </div>
        {remindLogError && <p className="break-words text-sm text-red-700" role="alert">{remindLogError}</p>}

        <div className="flex items-start justify-between gap-4 border-t border-soft-lilac/70 pt-4">
          <div className="min-w-0">
            <p id="remind-period-label" className="break-words font-medium text-deep-plum">{t("remind.period")}</p>
            <p className="mt-1 break-words text-sm leading-6 text-gray-700">{t("remind.periodHint")}</p>
          </div>
          <button
            className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${remindPeriod ? "gradient-aurora border-transparent" : "border-[#CDBDEB] bg-soft-lilac/40"}`}
            type="button"
            role="switch"
            aria-labelledby="remind-period-label"
            aria-checked={remindPeriod}
            disabled={remindPeriodSaving}
            onClick={() => void setRemindPeriod(!remindPeriod)}
          >
            <span className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${remindPeriod ? "translate-x-7" : "translate-x-0"}`} />
          </button>
        </div>
        {remindPeriodError && <p className="break-words text-sm text-red-700" role="alert">{remindPeriodError}</p>}
      </Card>

      <Card as="section" className="space-y-4">
          <h2 className="text-xl font-semibold text-deep-plum">{t("account.title")}</h2>
          <Link
            href="/settings/profile"
            className="inline-flex min-h-11 items-center rounded-full border border-[#CDBDEB] bg-white px-4 text-sm font-semibold text-deep-plum underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
          >
            {t("profile.edit")}
          </Link>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all text-sm text-gray-800">{user?.email ? showEmail ? user.email : maskEmail(user.email) : ""}</span>
              <Button type="button" variant="secondary" className="px-3" onClick={() => setShowEmail((current) => !current)}>
                {showEmail ? t("account.hide") : t("account.show")}
              </Button>
            </div>
            <p className="text-xs text-gray-600">{t("account.emailHidden")}</p>
          </div>
          <div className="space-y-2 border-t border-soft-lilac pt-4">
            <Button variant="secondary" type="button" onClick={forgetAllAccounts}>
              {t("login.forgetAll")}
            </Button>
            {recentAccountsMessage && <p className="break-words text-sm text-red-700" role="alert">{recentAccountsMessage}</p>}
          </div>
          <form className="space-y-3 border-t border-soft-lilac pt-4" onSubmit={changePassword}>
            <h3 className="font-semibold text-deep-plum">{t("account.changePassword")}</h3>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              {t("reset.newPassword")}
              <Input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              {t("reset.confirmPassword")}
              <Input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
            {passwordMessage && <p className={`break-words text-sm ${passwordMessage === t("account.passwordChanged") ? "text-emerald-800" : "text-red-700"}`} role="status"><FriendlyErrorMessage message={passwordMessage} /></p>}
            <Button type="submit" disabled={passwordSaving}>{passwordSaving ? t("reset.saving") : t("reset.update")}</Button>
          </form>
        </Card>

        <Card as="section" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-deep-plum">{t("settings.interests")}</h2>
          <p className="mt-1 text-sm text-gray-700">{t("onb.interestsBody")}</p>
        </div>
        <div className="space-y-3">
          <p className="text-right text-sm text-gray-600">{selectedInterests.length}/6</p>
          <InterestPicker selected={selectedInterests} onChange={setSelectedInterests} disabled={savingInterests} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={savingInterests} onClick={() => void saveInterests()}>
            {t("common.saveChanges")}
          </Button>
          <Button variant="secondary" type="button" disabled={savingInterests} onClick={() => void resetInterests()}>
            {t("settings.interestsReset")}
          </Button>
        </div>
        {interestMessage && <p className="break-words text-sm text-gray-700" role="status"><FriendlyErrorMessage message={interestMessage} /></p>}
        <div className="border-t border-soft-lilac/70 pt-4">
          <h3 className="font-semibold text-deep-plum">{t("settings.ageGroup")}</h3>
          {ageGroup && <p className="mt-1 text-sm text-gray-700">{t(ageGroup === "teen" ? "onb.age13" : "onb.age18")}</p>}
          <Link className="mt-2 inline-flex min-h-11 items-center break-words text-sm text-deep-plum underline" href="/feedback">
            {t("settings.ageChange")}
          </Link>
        </div>
      </Card>

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
        {message && <p className="text-sm font-medium text-red-800" role="alert"><FriendlyErrorMessage message={message} /></p>}
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