 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [name, setName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
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
    setIsAdmin(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-rose-50 px-6 text-center">
      <h1 className="text-4xl font-bold text-rose-900">Her Space</h1>
      <p className="mt-4 max-w-md text-lg text-rose-800">
        Learn. Share. Know yourself.
      </p>

      {!loading && name && (
        <div className="mt-8 space-y-3">
          <p className="text-rose-900">Welcome, {name} 🌸</p>
          {isAdmin && (
            <Link className="text-sm text-rose-800 underline" href="/admin">
              Admin
            </Link>
          )}
          <div className="flex justify-center gap-3">
            <a className="rounded bg-rose-700 px-4 py-2 text-white" href="/feed">
              Go to feed
            </a>
            <a className="rounded border border-rose-700 px-4 py-2 text-rose-700" href="/new">
              Write a post
            </a>
          </div>
          <button
            className="rounded border border-rose-700 px-4 py-2 text-rose-700"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      )}

      {!loading && !name && (
        <div className="mt-8 flex gap-3">
          <a className="rounded bg-rose-700 px-4 py-2 text-white" href="/signup">
            Sign up
          </a>
          <a className="rounded border border-rose-700 px-4 py-2 text-rose-700" href="/login">
            Log in
          </a>
        </div>
      )}
    </main>
  );
}