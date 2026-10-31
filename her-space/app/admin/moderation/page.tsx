"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/lib/errors";
import type { TranslationKey } from "@/lib/i18n/en";
import { supabase } from "@/lib/supabase";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PageShell from "@/components/ui/PageShell";
import Textarea from "@/components/ui/Textarea";

type ModTemplate = {
  id: string;
  title: string;
  body: string;
  body_am: string | null;
};

type ModerationLog = {
  id: string;
  action: string;
  report_category: string | null;
  target_kind: string;
  note: string | null;
  created_at: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

type Moderator = {
  user_id: string;
  added_at: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

type TemplateForm = {
  title: string;
  body: string;
  body_am: string;
};

const emptyForm: TemplateForm = { title: "", body: "", body_am: "" };
const errorText: Partial<Record<TranslationKey, string>> = {
  "errors.rateLimit": "Please wait a moment before trying again.",
  "errors.network": "Check your connection and try again.",
  "errors.sessionExpired": "Your session expired. Please sign in again.",
  "errors.generic": "Something went wrong. Please try again.",
};
const translateError = (key: TranslationKey) => errorText[key] ?? "Something went wrong. Please try again.";

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function containsPlaceholders(value: string) {
  return value.includes("[") && value.includes("]");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLabel(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

export default function AdminModerationPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ModTemplate[]>([]);
  const [log, setLog] = useState<ModerationLog[]>([]);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAdminPage() {
      const { data: authData } = await supabase.auth.getUser();
      if (!active) return;
      if (!authData.user) {
        router.replace("/");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (!active) return;
      if (adminError || !admin) {
        router.replace("/");
        return;
      }
      setAuthorized(true);

      const [templatesResult, logResult, moderatorsResult] = await Promise.all([
        supabase.from("mod_templates").select("id, title, body, body_am").order("title", { ascending: true }),
        supabase
          .from("moderation_log")
          .select("id, action, report_category, target_kind, note, created_at, profiles!moderation_log_actor_id_fkey(display_name)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("moderators")
          .select("user_id, added_at, profiles!moderators_user_id_fkey(display_name)")
          .order("added_at", { ascending: true }),
      ]);

      if (!active) return;
      const errors = [templatesResult.error, logResult.error, moderatorsResult.error].filter(Boolean);
      if (errors.length) setErrorMessage(friendlyError(errors[0], translateError));
      if (!templatesResult.error) setTemplates((templatesResult.data ?? []) as ModTemplate[]);
      if (!logResult.error) setLog((logResult.data ?? []) as ModerationLog[]);
      if (!moderatorsResult.error) setModerators((moderatorsResult.data ?? []) as Moderator[]);
      setLoading(false);
    }

    void loadAdminPage();
    return () => {
      active = false;
    };
  }, [router]);

  function startEditing(template: ModTemplate) {
    setEditingId(template.id);
    setForm({ title: template.title, body: template.body, body_am: template.body_am ?? "" });
    setSuccessMessage("");
    setErrorMessage("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    const data = {
      title: form.title.trim(),
      body: form.body.trim(),
      body_am: form.body_am.trim() || null,
    };
    const result = editingId
      ? await supabase.from("mod_templates").update(data).eq("id", editingId)
      : await supabase.from("mod_templates").insert(data);

    if (result.error) {
      setErrorMessage(friendlyError(result.error, translateError));
      setSaving(false);
      return;
    }

    const { data: updatedTemplates, error } = await supabase
      .from("mod_templates")
      .select("id, title, body, body_am")
      .order("title", { ascending: true });
    if (error) {
      setErrorMessage(friendlyError(error, translateError));
    } else {
      setTemplates((updatedTemplates ?? []) as ModTemplate[]);
      setSuccessMessage(editingId ? "Template updated." : "Template added.");
      resetForm();
    }
    setSaving(false);
  }

  async function deleteTemplate(template: ModTemplate) {
    if (busyId || !window.confirm(`Delete “${template.title}”? This cannot be undone.`)) return;
    setBusyId(template.id);
    setErrorMessage("");
    setSuccessMessage("");
    const { error } = await supabase.from("mod_templates").delete().eq("id", template.id);
    if (error) {
      setErrorMessage(friendlyError(error, translateError));
    } else {
      setTemplates((current) => current.filter((entry) => entry.id !== template.id));
      if (editingId === template.id) resetForm();
      setSuccessMessage("Template deleted.");
    }
    setBusyId(null);
  }

  if (loading || !authorized) {
    return (
      <PageShell className="max-w-5xl px-4 py-6 md:px-6 md:py-10">
        <p className="sr-only">Checking administrator access…</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-5xl space-y-8 px-4 py-6 md:px-6 md:py-10">
      <header>
        <h1 className="text-3xl font-bold text-deep-plum">Moderation administration</h1>
        <p className="mt-2 text-gray-700">Manage moderator messages, review the decision log, and see the moderation team.</p>
      </header>

      {errorMessage && <Card className="whitespace-pre-line text-red-700" role="alert">{errorMessage}</Card>}
      {successMessage && <Card className="text-green-800" role="status">{successMessage}</Card>}

      <section className="space-y-4" aria-labelledby="templates-heading">
        <div>
          <h2 id="templates-heading" className="text-xl font-semibold text-deep-plum">Message templates</h2>
          <p className="mt-1 text-sm text-gray-600">Templates are editable by moderators before they send a message.</p>
        </div>

        <Card>
          <form className="space-y-4" onSubmit={(event) => void saveTemplate(event)}>
            <h3 className="font-semibold text-deep-plum">{editingId ? "Edit template" : "Add a template"}</h3>
            <label className="block space-y-1 text-sm font-medium text-deep-plum">
              Title
              <Input value={form.title} maxLength={120} required onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="block space-y-1 text-sm font-medium text-deep-plum">
              Message body (1000 characters max)
              <Textarea className="min-h-28" value={form.body} maxLength={1000} required onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <label className="block space-y-1 text-sm font-medium text-deep-plum">
              Amharic body (optional, 1000 characters max)
              <Textarea className="min-h-24" value={form.body_am} maxLength={1000} onChange={(event) => setForm((current) => ({ ...current, body_am: event.target.value }))} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add template"}</Button>
              {editingId && <Button variant="ghost" type="button" onClick={resetForm}>Cancel edit</Button>}
            </div>
          </form>
        </Card>

        {templates.length === 0 ? (
          <Card className="text-gray-700">No message templates yet.</Card>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => {
              const hasPlaceholders = containsPlaceholders(template.body) || containsPlaceholders(template.body_am ?? "");
              return (
                <Card as="article" key={template.id} className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <h3 className="break-words font-semibold text-deep-plum">{template.title}</h3>
                      {hasPlaceholders && <Badge variant="rose">Contains placeholders. Fill them in before sending.</Badge>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button className="min-h-11 px-4" variant="secondary" type="button" onClick={() => startEditing(template)}>Edit</Button>
                      <Button className="min-h-11 px-4" variant="ghost" type="button" disabled={busyId === template.id} onClick={() => void deleteTemplate(template)}>Delete</Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-gray-800">{template.body}</p>
                  {template.body_am && <p className="whitespace-pre-wrap break-words text-sm text-gray-600">{template.body_am}</p>}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="log-heading">
        <div>
          <h2 id="log-heading" className="text-xl font-semibold text-deep-plum">Decision log</h2>
          <p className="mt-1 text-sm text-gray-600">Latest 100 moderation decisions. This log contains no post or comment content.</p>
        </div>
        {log.length === 0 ? (
          <Card className="text-gray-700">No moderation decisions recorded.</Card>
        ) : (
          <div className="space-y-2">
            {log.map((entry) => (
              <Card as="article" key={entry.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-deep-plum">{first(entry.profiles)?.display_name ?? "Moderator"}</span>
                  <Badge>{formatLabel(entry.action)}</Badge>
                  <span className="text-gray-700">{formatLabel(entry.report_category)}</span>
                  <span className="text-gray-500">{formatLabel(entry.target_kind)}</span>
                  {entry.note && <span className="max-w-full break-words text-gray-600">{entry.note}</span>}
                </div>
                <time className="text-xs text-gray-500" dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="team-heading">
        <div>
          <h2 id="team-heading" className="text-xl font-semibold text-deep-plum">Team</h2>
          <p className="mt-1 text-sm text-gray-600">Moderators are adults who answered the age question.</p>
        </div>
        <Card className="space-y-3">
          {moderators.length === 0 ? (
            <p className="text-sm text-gray-700">No moderators are listed.</p>
          ) : (
            <ul className="divide-y divide-soft-lilac/60">
              {moderators.map((moderator) => (
                <li className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2" key={moderator.user_id}>
                  <span className="font-medium text-deep-plum">{first(moderator.profiles)?.display_name ?? "Her Space member"}</span>
                  <span className="text-xs text-gray-500">Added {formatDate(moderator.added_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 border-t border-soft-lilac/60 pt-3">
            <p className="text-sm text-gray-700">To add an eligible moderator, run this in the Supabase SQL Editor:</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-xs text-gray-800"><code>{"insert into public.moderators (user_id) select id from public.profiles where display_name = 'her-name';"}</code></pre>
          </div>
        </Card>
      </section>
    </PageShell>
  );
}
