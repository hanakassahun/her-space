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
  loading: boolean;
  quietMode: boolean;
  quietModeSaving: boolean;
  quietModeError: string;
  setQuietMode: (next: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quietMode, setQuietModeState] = useState(false);
  const [quietModeSaving, setQuietModeSaving] = useState(false);
  const [quietModeError, setQuietModeError] = useState("");
  const activeUserId = useRef<string | null>(null);
  const requestId = useRef(0);

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

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    async function loadUserData(nextSession: Session | null) {
      const nextUserId = nextSession?.user.id ?? null;
      setSession(nextSession);

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
        setQuietModeState(false);
        setQuietModeSaving(false);
        setQuietModeError("");
        setLoading(false);
        return;
      }

      setDisplayName(null);
      setIsAdmin(false);
      setQuietModeState(false);
      setQuietModeSaving(false);
      setQuietModeError("");

      const [profileResult, adminResult, prefsResult] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", nextUserId).maybeSingle(),
        supabase.from("admins").select("user_id").eq("user_id", nextUserId).maybeSingle(),
        supabase.from("member_prefs").select("quiet_mode").eq("user_id", nextUserId).maybeSingle(),
      ]);

      if (!active || currentRequestId !== requestId.current) return;
      setDisplayName(profileResult.data?.display_name ?? null);
      setIsAdmin(Boolean(adminResult.data));
      setQuietModeState(Boolean(prefsResult.data?.quiet_mode));
      if (prefsResult.error) setQuietModeError(friendlyError(prefsResult.error, t));
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
    loading,
    quietMode,
    quietModeSaving,
    quietModeError,
    setQuietMode,
  }), [displayName, isAdmin, loading, quietMode, quietModeError, quietModeSaving, session, setQuietMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}