"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  displayName: string | null;
  isAdmin: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const activeUserId = useRef<string | null>(null);
  const requestId = useRef(0);

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
        setLoading(false);
        return;
      }

      setDisplayName(null);
      setIsAdmin(false);

      const [profileResult, adminResult] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", nextUserId).maybeSingle(),
        supabase.from("admins").select("user_id").eq("user_id", nextUserId).maybeSingle(),
      ]);

      if (!active || currentRequestId !== requestId.current) return;
      setDisplayName(profileResult.data?.display_name ?? null);
      setIsAdmin(Boolean(adminResult.data));
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
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    displayName,
    isAdmin,
    loading,
  }), [displayName, isAdmin, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}