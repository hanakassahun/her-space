 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function Home() {
  const [name, setName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .single();
        setName(profile?.display_name ?? "friend");
        const { data: admin } = await supabase
          .from("admins")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        setIsAdmin(Boolean(admin));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setName(null);
    setUserId(null);
    setIsAdmin(false);
  }

  return (
    <PageShell className="flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="bg-clip-text text-5xl font-bold text-transparent gradient-aurora">Her Space</h1>
      <p className="mt-4 max-w-md text-lg text-deep-plum">
        Learn. Share. Know yourself.
      </p>

      {!loading && name && (
        <Card className="mt-8 w-full max-w-xl space-y-4 text-deep-plum">
          <p>Welcome, {name} 🌸</p>
          {isAdmin && (
            <Link className="text-sm text-deep-plum underline" href="/admin">
              Admin
            </Link>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <Link className="gradient-aurora shadow-glow inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-white" href="/feed">
              Go to feed
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 bg-white/65 px-5 py-2 text-sm font-semibold text-deep-plum" href="/explore">
              Explore
            </Link>
            {userId && (
              <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 bg-white/65 px-5 py-2 text-sm font-semibold text-deep-plum" href={`/u/${userId}`}>
                My profile
              </Link>
            )}
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 bg-white/65 px-5 py-2 text-sm font-semibold text-deep-plum" href="/library">
              My Library
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 bg-white/65 px-5 py-2 text-sm font-semibold text-deep-plum" href="/new">
              Write a post
            </Link>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
          >
            Log out
          </Button>
        </Card>
      )}

      {!loading && !name && (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link className="gradient-aurora shadow-glow inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 font-semibold text-white" href="/signup">
            Sign up
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 bg-white/65 px-6 py-3 font-semibold text-deep-plum" href="/login">
            Log in
          </Link>
        </div>
      )}
    </PageShell>
  );
}