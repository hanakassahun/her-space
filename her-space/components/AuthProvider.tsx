"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { useLanguage } from "@/components/LanguageProvider";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  displayName: string | null;
  isAdmin: boolean;
  isModerator: boolean;
  loading: boolean;
  quietMode: boolean;
  quietModeSaving: boolean;
  quietModeError: string;
  setQuietMode: (next: boolean) => Promise<void>;
  remindLog: boolean;
  remindLogSaving: boolean;
  remindLogError: string;
  setRemindLog: (next: boolean) => Promise<void>;
  remindPeriod: boolean;
  remindPeriodSaving: boolean;
  remindPeriodError: string;
  setRemindPeriod: (next: boolean) => Promise<void>;
  notificationPrefs: {
    notif_comments: boolean;
    notif_follows: boolean;
    notif_shares: boolean;
    notif_milestones: boolean;
  };
  notificationsPausedUntil: string | null;
  notificationPrefsSaving: boolean;
  notificationPrefsError: string;
  setNotificationPreference: (
    key: "notif_comments" | "notif_follows" | "notif_shares" | "notif_milestones" | "notifications_paused_until",
    value: boolean | string | null
  ) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quietMode, setQuietModeState] = useState(false);
  const [quietModeSaving, setQuietModeSaving] = useState(false);
  const [quietModeError, setQuietModeError] = useState("");
  const [remindLog, setRemindLogState] = useState(false);
  const [remindLogSaving, setRemindLogSaving] = useState(false);
  const [remindLogError, setRemindLogError] = useState("");
  const [remindPeriod, setRemindPeriodState] = useState(false);
  const [remindPeriodSaving, setRemindPeriodSaving] = useState(false);
  const [remindPeriodError, setRemindPeriodError] = useState("");
  const [notificationPrefs, setNotificationPrefs] = useState({
    notif_comments: true,
    notif_follows: true,
    notif_shares: true,
    notif_milestones: true,
  });
  const [notificationsPausedUntil, setNotificationsPausedUntilState] = useState<string | null>(null);
  const [notificationPrefsSaving, setNotificationPrefsSaving] = useState(false);
  const [notificationPrefsError, setNotificationPrefsError] = useState("");
  const activeUserId = useRef<string | null>(null);
  const requestId = useRef(0);
  const savingNotificationPrefs = useRef(new Set<string>());
  const lastVisitPingedDate = useRef<string | null>(null);

  const setQuietMode = useCallback(async (next: boolean) => {
    const userId = activeUserId.current;
    if (!userId || quietModeSaving) return;

    const previous = quietMode;
    const currentRequestId = requestId.current;
    setQuietModeState(next);
    setQuietModeSaving(true);
    setQuietModeError("");
    try {
      const { error } = await supabase
        .from("member_prefs")
        .upsert(
          { quiet_mode: next, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    } catch (error) {
      if (activeUserId.current === userId && currentRequestId === requestId.current) {
        setQuietModeState(previous);
        setQuietModeError(friendlyError(error, t));
      }
    } finally {
      if (activeUserId.current === userId && currentRequestId === requestId.current) {
        setQuietModeSaving(false);
      }
    }
  }, [quietMode, quietModeSaving, t]);

  const setRemindLog = useCallback(async (next: boolean) => {
    const userId = activeUserId.current;
    if (!userId || remindLogSaving) return;

    const previous = remindLog;
    const currentRequestId = requestId.current;
    setRemindLogState(next);
    setRemindLogSaving(true);
    setRemindLogError("");
    try {
      const { error } = await supabase
        .from("member_prefs")
        .upsert(
          { remind_log: next, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    } catch (error) {
      if (activeUserId.current === userId && currentRequestId === requestId.current) {
        setRemindLogState(previous);
        setRemindLogError(friendlyError(error, t));
      }
    } finally {
      if (activeUserId.current === userId && currentRequestId === requestId.current) {
        setRemindLogSaving(false);
      }
    }
  }, [remindLog, remindLogSaving, t]);

  const setRemindPeriod = useCallback(async (next: boolean) => {
    const userId = activeUserId.current;
    if (!userId || remindPeriodSaving) return;

    const previous = remindPeriod;
    const currentRequestId = requestId.current;
    setRemindPeriodState(next);
    setRemindPeriodSaving(true);
    setRemindPeriodError("");
    try {
      const { error } = await supabase
        .from("member_prefs")
        .upsert(
          { remind_period: next, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    } catch (error) {
      if (activeUserId.current === userId && currentRequestId === requestId.current) {
        setRemindPeriodState(previous);
        setRemindPeriodError(friendlyError(error, t));
      }
    } finally {
      if (activeUserId.current === userId && currentRequestId === requestId.current) {
        setRemindPeriodSaving(false);
      }
    }
  }, [remindPeriod, remindPeriodSaving, t]);

  const setNotificationPreference = useCallback(async (
    key: "notif_comments" | "notif_follows" | "notif_shares" | "notif_milestones" | "notifications_paused_until",
    value: boolean | string | null
  ) => {
    const userId = activeUserId.current;
    if (!userId || savingNotificationPrefs.current.has(key)) return;

    const previous = key === "notifications_paused_until"
      ? notificationsPausedUntil
      : notificationPrefs[key];
    const currentRequestId = requestId.current;
    if (key === "notifications_paused_until") setNotificationsPausedUntilState(value as string | null);
    else setNotificationPrefs((current) => ({ ...current, [key]: value as boolean }));
    savingNotificationPrefs.current.add(key);
    setNotificationPrefsSaving(true);
    setNotificationPrefsError("");
    try {
      const { error } = await supabase
        .from("member_prefs")
        .upsert(
          { [key]: value, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    } catch (error) {
      if (activeUserId.current === userId && currentRequestId === requestId.current) {
        if (key === "notifications_paused_until") setNotificationsPausedUntilState(previous as string | null);
        else setNotificationPrefs((current) => ({ ...current, [key]: previous as boolean }));
        setNotificationPrefsError(friendlyError(error, t));
      }
    } finally {
      if (currentRequestId === requestId.current) {
        savingNotificationPrefs.current.delete(key);
      }
      if (activeUserId.current === userId && currentRequestId === requestId.current) {
        setNotificationPrefsSaving(savingNotificationPrefs.current.size > 0);
      }
    }
  }, [notificationPrefs, notificationsPausedUntil, t]);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    async function pingVisitForToday() {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (lastVisitPingedDate.current === localDate) return;
      try {
        if (window.localStorage.getItem("lastVisitPing") === localDate) {
          lastVisitPingedDate.current = localDate;
          return;
        }
        window.localStorage.setItem("lastVisitPing", localDate);
      } catch {
        if (lastVisitPingedDate.current === localDate) return;
      }
      lastVisitPingedDate.current = localDate;
      try {
        await supabase.rpc("touch_visit");
      } catch {
        // Visit pings are intentionally best-effort.
      }
    }

    async function loadUserData(nextSession: Session | null) {
      const nextUserId = nextSession?.user.id ?? null;
      setSession(nextSession);

      if (nextUserId) void pingVisitForToday();
      if (nextUserId === activeUserId.current) {
        setLoading(false);
        return;
      }

      activeUserId.current = nextUserId;
      const currentRequestId = ++requestId.current;
      setLoading(false);

      if (!nextUserId) {
        setDisplayName(null);
        setIsAdmin(false);
        setIsModerator(false);
        setQuietModeState(false);
        setQuietModeSaving(false);
        setQuietModeError("");
        setRemindLogState(false);
        setRemindLogSaving(false);
        setRemindLogError("");
        setRemindPeriodState(false);
        setRemindPeriodSaving(false);
        setRemindPeriodError("");
        setNotificationPrefs({ notif_comments: true, notif_follows: true, notif_shares: true, notif_milestones: true });
        setNotificationsPausedUntilState(null);
        setNotificationPrefsSaving(false);
        setNotificationPrefsError("");
        savingNotificationPrefs.current.clear();
        setLoading(false);
        return;
      }

      setDisplayName(null);
      setIsAdmin(false);
      setIsModerator(false);
      setQuietModeState(false);
      setQuietModeSaving(false);
      setQuietModeError("");
      setRemindLogState(false);
      setRemindLogSaving(false);
      setRemindLogError("");
      setRemindPeriodState(false);
      setRemindPeriodSaving(false);
      setRemindPeriodError("");
      setNotificationPrefs({ notif_comments: true, notif_follows: true, notif_shares: true, notif_milestones: true });
      setNotificationsPausedUntilState(null);
      setNotificationPrefsSaving(false);
      setNotificationPrefsError("");
      savingNotificationPrefs.current.clear();

      const [profileResult, adminResult, moderatorResult, prefsResult] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", nextUserId).maybeSingle(),
        supabase.from("admins").select("user_id").eq("user_id", nextUserId).maybeSingle(),
        supabase.rpc("is_moderator"),
        supabase.from("member_prefs").select("quiet_mode, remind_log, remind_period, notif_comments, notif_follows, notif_shares, notif_milestones, notifications_paused_until").eq("user_id", nextUserId).maybeSingle(),
      ]);

      if (!active || currentRequestId !== requestId.current) return;
      setDisplayName(profileResult.data?.display_name ?? null);
      setIsAdmin(Boolean(adminResult.data));
      setIsModerator(Boolean(moderatorResult.data));
      setQuietModeState(Boolean(prefsResult.data?.quiet_mode));
      setRemindLogState(Boolean(prefsResult.data?.remind_log));
      setRemindPeriodState(Boolean(prefsResult.data?.remind_period));
      setNotificationPrefs({
        notif_comments: prefsResult.data?.notif_comments ?? true,
        notif_follows: prefsResult.data?.notif_follows ?? true,
        notif_shares: prefsResult.data?.notif_shares ?? true,
        notif_milestones: prefsResult.data?.notif_milestones ?? true,
      });
      setNotificationsPausedUntilState(prefsResult.data?.notifications_paused_until ?? null);
      if (prefsResult.error) {
        const errorMessage = friendlyError(prefsResult.error, t);
        setQuietModeError(errorMessage);
        setNotificationPrefsError(errorMessage);
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      setSession(nextSession);
      window.setTimeout(() => void loadUserData(nextSession), 0);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEventReceived) return;
      if (error) {
        setLoading(false);
        return;
      }
      void loadUserData(data.session);
    }).catch(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [t]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    displayName,
    isAdmin,
    isModerator,
    loading,
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
  }), [displayName, isAdmin, isModerator, loading, quietMode, quietModeError, quietModeSaving, remindLog, remindLogSaving, remindLogError, remindPeriod, remindPeriodSaving, remindPeriodError, session, setQuietMode, setRemindLog, setRemindPeriod, notificationPrefs, notificationsPausedUntil, notificationPrefsSaving, notificationPrefsError, setNotificationPreference]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}