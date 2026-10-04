"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

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
    <PageShell className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-deep-plum">Join Her Space</h1>
        <p className="text-deep-plum">
          Pick a display name. It doesn&apos;t have to be your real name.
        </p>
        <Input
          placeholder="Invite code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
        <Input
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password (at least 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          className="w-full"
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create account"}
        </Button>
        {message && <p className="text-red-700">{message}</p>}
      </Card>
    </PageShell>
  );
}