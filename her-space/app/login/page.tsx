"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-rose-50 px-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-rose-900">Welcome back</h1>
        <input
          className="w-full rounded border border-rose-300 bg-white p-3 text-gray-900 placeholder:text-gray-400"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded border border-rose-300 bg-white p-3 text-gray-900 placeholder:text-gray-400"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="w-full rounded bg-rose-700 p-3 text-white disabled:opacity-50"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Log in"}
        </button>
        {message && <p className="text-red-600">{message}</p>}
        <p className="text-rose-800">
          New here?{" "}
          <a className="underline" href="/signup">
            Create an account
          </a>
        </p>
      </div>
    </main>
  );
}