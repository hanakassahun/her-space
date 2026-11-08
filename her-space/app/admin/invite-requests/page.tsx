"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type RequestStatus = "new" | "invited" | "dismissed";
type InviteRequest = { id: string; contact: string; note: string | null; status: RequestStatus; created_at: string };

export default function AdminInviteRequestsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [requests, setRequests] = useState<InviteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from("invite_requests")
      .select("id, contact, note, status, created_at")
      .order("created_at", { ascending: false });
    if (error) setMessage(friendlyError(error, (value) => value));
    else setRequests((data ?? []) as InviteRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
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
      if (!active) return;
      if (error || !admin) {
        router.replace("/");
        return;
      }
      setAuthorized(true);
      await loadRequests();
    }
    void checkAdmin();
    return () => { active = false; };
  }, [loadRequests, router]);

  async function updateStatus(request: InviteRequest, status: RequestStatus) {
    if (busyId) return;
    setBusyId(request.id);
    setMessage("");
    const { error } = await supabase.from("invite_requests").update({ status }).eq("id", request.id);
    if (error) setMessage(friendlyError(error, (value) => value));
    else setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status } : item));
    setBusyId(null);
  }

  async function deleteRequest(request: InviteRequest) {
    if (busyId) return;
    setBusyId(request.id);
    setMessage("");
    const { error } = await supabase.from("invite_requests").delete().eq("id", request.id);
    if (error) setMessage(friendlyError(error, (value) => value));
    else setRequests((current) => current.filter((item) => item.id !== request.id));
    setBusyId(null);
  }

  async function deleteDismissed() {
    if (deletingAll) return;
    setDeletingAll(true);
    setMessage("");
    const { error } = await supabase.from("invite_requests").delete().eq("status", "dismissed");
    if (error) setMessage(friendlyError(error, (value) => value));
    else setRequests((current) => current.filter((item) => item.status !== "dismissed"));
    setDeletingAll(false);
  }

  async function copyContact(contact: string) {
    try {
      await navigator.clipboard.writeText(contact);
    } catch (error) {
      setMessage(friendlyError(error, (value) => value));
    }
  }

  if (!authorized) return <PageShell className="max-w-4xl"><p className="sr-only">Checking administrator access…</p></PageShell>;

  return (
    <PageShell className="max-w-4xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-deep-plum">Invite requests</h1>
        <Link className="inline-flex min-h-11 items-center rounded-full border border-soft-lilac bg-white px-4 text-sm font-semibold text-deep-plum underline" href="/admin">Back to admin</Link>
      </header>
      <Button variant="secondary" type="button" disabled={deletingAll || !requests.some((item) => item.status === "dismissed")} onClick={() => void deleteDismissed()}>
        Delete all dismissed
      </Button>
      {message && <Card className="break-words text-red-700" role="alert">{message}</Card>}
      {loading && <p className="text-gray-700">Loading requests…</p>}
      {!loading && requests.length === 0 && <Card className="text-gray-700">No invite requests.</Card>}
      <section className="space-y-3" aria-label="Invite requests">
        {requests.map((request) => (
          <Card as="article" className="space-y-3" key={request.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="break-all font-semibold text-deep-plum">{request.contact}</p>
                {request.note && <p className="break-words whitespace-pre-wrap text-sm leading-6 text-gray-700">{request.note}</p>}
                <time className="block text-xs text-gray-500" dateTime={request.created_at}>{new Date(request.created_at).toLocaleString()}</time>
              </div>
              <span className="rounded-full bg-soft-lilac px-3 py-1 text-sm font-medium text-deep-plum">{request.status}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" type="button" onClick={() => void copyContact(request.contact)}>Copy contact</Button>
              {(["new", "invited", "dismissed"] as const).map((status) => (
                <Button key={status} variant={request.status === status ? "primary" : "secondary"} type="button" disabled={busyId === request.id || request.status === status} onClick={() => void updateStatus(request, status)}>{status}</Button>
              ))}
              <Button variant="ghost" className="text-red-800" type="button" disabled={busyId === request.id} onClick={() => void deleteRequest(request)}>Delete</Button>
            </div>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}
