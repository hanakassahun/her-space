"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setLoading(true);
    setMessage("");

    const trimmedInviteCode = inviteCode.trim();
    const { data: inviteIsValid, error: inviteError } = await supabase.rpc(
      "is_invite_code_valid",
      { p_code: trimmedInviteCode }
    );
    if (inviteError) {
      setMessage(inviteError.message);
      setLoading(false);
      return;
    }
    if (!inviteIsValid) {
      setMessage("That invite code isn't valid or has been used up.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      const signupMessage = error?.message ?? "Something went wrong.";
      setMessage(
        signupMessage.toLowerCase().includes("you can only request this after")
          ? "Please wait a moment and try again."
          : signupMessage
      );
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: data.user.id, display_name: displayName });

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    await supabase.rpc("redeem_invite_code", { p_code: trimmedInviteCode });
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-rose-50 px-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-rose-900">Join Her Space</h1>
        <p className="text-rose-800">
          Pick a display name. It doesn&apos;t have to be your real name.
        </p>
        <input
          className="w-full rounded border border-rose-300 bg-white p-3 text-gray-900 placeholder:text-gray-400"
          placeholder="Invite code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
        <input
           className="w-full rounded border border-rose-300 bg-white p-3 text-gray-900 placeholder:text-gray-400"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
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
          placeholder="Password (at least 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="w-full rounded bg-rose-700 p-3 text-white disabled:opacity-50"
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create account"}
        </button>
        {message && <p className="text-red-600">{message}</p>}
      </div>
    </main>
  );
}