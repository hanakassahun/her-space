"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

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
    <PageShell className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-deep-plum">Welcome back</h1>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          className="w-full"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Log in"}
        </Button>
        {message && <p className="text-red-700">{message}</p>}
        <p className="text-deep-plum">
          New here?{" "}
          <a className="underline" href="/signup">
            Create an account
          </a>
        </p>
      </Card>
    </PageShell>
  );
}