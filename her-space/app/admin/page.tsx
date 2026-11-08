"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/");
        return;
      }

      const { data: admin, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (error || !admin) {
        router.replace("/");
        return;
      }
      setAuthorized(true);
    }

    void checkAdmin();
  }, [router]);

  if (!authorized) {
    return (
      <PageShell className="max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <p className="sr-only">Checking administrator access…</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-4xl space-y-8 px-4 py-6 md:px-6 md:py-10">
      <header>
        <h1 className="mt-3 text-3xl font-bold text-deep-plum">Admin</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/admin/articles">
            Manage articles
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/admin/collections">
            Manage collections
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/admin/resources">
            Manage resources
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/admin/invites">
            Manage invites
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/admin/stats">
            Demand dashboard
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/admin/invite-requests">
            Invite requests
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/admin/feedback">
            Member feedback
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/admin/moderation">
            Moderation administration
          </Link>
        </div>
      </header>

      <Link href="/moderation" className="block">
        <Card className="space-y-2 transition hover:bg-white/80">
          <h2 className="font-semibold text-deep-plum">Moderation console</h2>
          <p className="text-sm text-gray-700">Review reports with a calmer, privacy-conscious queue.</p>
        </Card>
      </Link>
    </PageShell>
  );
}
