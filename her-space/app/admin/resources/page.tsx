"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

type ResourceKind =
  | "clinic"
  | "hospital"
  | "gynecologist"
  | "pharmacy"
  | "counseling"
  | "hotline"
  | "other";

type Resource = {
  id: string;
  name: string;
  kind: ResourceKind;
  city: string;
  area: string | null;
  services: string[];
  approx_cost: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  last_verified: string | null;
  published: boolean;
};

type ResourceSuggestion = {
  id: string;
  suggested_by: string;
  details: string;
  status: "open" | "added" | "dismissed";
  created_at: string;
};

type ResourceForm = {
  name: string;
  kind: ResourceKind;
  city: string;
  area: string;
  services: string;
  approxCost: string;
  phone: string;
  address: string;
  notes: string;
  lastVerified: string;
  published: boolean;
};

const kindLabels: Record<ResourceKind, string> = {
  clinic: "Clinic",
  hospital: "Hospital",
  gynecologist: "Gynecologist",
  pharmacy: "Pharmacy",
  counseling: "Counseling",
  hotline: "Hotline",
  other: "Other",
};

const emptyForm: ResourceForm = {
  name: "",
  kind: "clinic",
  city: "Addis Ababa",
  area: "",
  services: "",
  approxCost: "",
  phone: "",
  address: "",
  notes: "",
  lastVerified: "",
  published: false,
};

async function fetchResources() {
  return supabase
    .from("resources")
    .select("id, name, kind, city, area, services, approx_cost, phone, address, notes, last_verified, published")
    .order("name", { ascending: true });
}

async function fetchOpenSuggestions() {
  return supabase
    .from("resource_suggestions")
    .select("id, suggested_by, details, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false });
}

function formFromResource(resource: Resource): ResourceForm {
  return {
    name: resource.name,
    kind: resource.kind,
    city: resource.city,
    area: resource.area ?? "",
    services: resource.services.join(", "),
    approxCost: resource.approx_cost ?? "",
    phone: resource.phone ?? "",
    address: resource.address ?? "",
    notes: resource.notes ?? "",
    lastVerified: resource.last_verified ?? "",
    published: resource.published,
  };
}

export default function AdminResourcesPage() {
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [suggestions, setSuggestions] = useState<ResourceSuggestion[]>([]);
  const [form, setForm] = useState<ResourceForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadAdminResources() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (adminError || !admin) {
        router.replace("/");
        return;
      }

      const [resourcesResult, suggestionsResult] = await Promise.all([
        fetchResources(),
        fetchOpenSuggestions(),
      ]);
      if (resourcesResult.error || suggestionsResult.error) {
        setMessage(resourcesResult.error?.message ?? suggestionsResult.error?.message ?? "Unable to load resources.");
      } else {
        setResources((resourcesResult.data ?? []) as Resource[]);
        setSuggestions((suggestionsResult.data ?? []) as ResourceSuggestion[]);
      }
      setLoading(false);
    }

    void loadAdminResources();
  }, [router]);

  function startEditing(resource: Resource) {
    setEditingId(resource.id);
    setForm(formFromResource(resource));
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");

    const resourceData = {
      name: form.name.trim(),
      kind: form.kind,
      city: form.city.trim(),
      area: form.area.trim() || null,
      services: form.services.split(",").map((service) => service.trim()).filter(Boolean),
      approx_cost: form.approxCost.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      last_verified: form.lastVerified || null,
      published: form.published,
    };

    const result = editingId
      ? await supabase.from("resources").update(resourceData).eq("id", editingId)
      : await supabase.from("resources").insert(resourceData);

    if (result.error) {
      setMessage(result.error.message);
      setSaving(false);
      return;
    }

    const { data, error } = await fetchResources();
    if (error) setMessage(error.message);
    else {
      setResources((data ?? []) as Resource[]);
      clearForm();
      setMessage(editingId ? "Resource updated." : "Resource created.");
    }
    setSaving(false);
  }

  async function togglePublished(resource: Resource) {
    setBusyId(resource.id);
    setMessage("");
    const { error } = await supabase
      .from("resources")
      .update({ published: !resource.published })
      .eq("id", resource.id);

    if (error) setMessage(error.message);
    else setResources((current) => current.map((item) =>
      item.id === resource.id ? { ...item, published: !resource.published } : item
    ));
    setBusyId(null);
  }

  async function deleteResource(resource: Resource) {
    if (!window.confirm(`Delete “${resource.name}”?`)) return;
    setBusyId(resource.id);
    setMessage("");
    const { error } = await supabase.from("resources").delete().eq("id", resource.id);

    if (error) setMessage(error.message);
    else {
      setResources((current) => current.filter((item) => item.id !== resource.id));
      if (editingId === resource.id) clearForm();
    }
    setBusyId(null);
  }

  async function updateSuggestion(suggestion: ResourceSuggestion, status: "added" | "dismissed") {
    setBusyId(suggestion.id);
    setMessage("");
    const { error } = await supabase
      .from("resource_suggestions")
      .update({ status })
      .eq("id", suggestion.id);

    if (error) setMessage(error.message);
    else setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
    setBusyId(null);
  }

  return (
    <PageShell className="max-w-4xl space-y-7 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-deep-plum">Manage resources</h1>
      </header>

      <Card as="div" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">{editingId ? "Edit resource" : "Add resource"}</h2>
        <form className="space-y-4" onSubmit={saveResource}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Name
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Kind
              <select
                className="min-h-11 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 text-deep-plum focus:outline-none focus:ring-2 focus:ring-soft-lilac"
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as ResourceKind })}
              >
                {Object.entries(kindLabels).map(([kind, label]) => (
                  <option key={kind} value={kind}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              City
              <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required />
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Area
              <Input value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Services (comma-separated)
              <Input value={form.services} onChange={(event) => setForm({ ...form, services: event.target.value })} />
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Approximate cost
              <Input value={form.approxCost} onChange={(event) => setForm({ ...form, approxCost: event.target.value })} />
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Phone
              <Input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Last verified
              <Input type="date" value={form.lastVerified} onChange={(event) => setForm({ ...form, lastVerified: event.target.value })} />
            </label>
          </div>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Address
            <Textarea className="min-h-20" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Notes
            <Textarea className="min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-deep-plum">
            <input
              className="h-4 w-4 accent-fuchsia-700"
              type="checkbox"
              checked={form.published}
              onChange={(event) => setForm({ ...form, published: event.target.checked })}
            />
            Published
          </label>
          {message && <p className="text-sm text-deep-plum" role="status">{message}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Add resource"}
            </Button>
            {editingId && <Button variant="secondary" type="button" onClick={clearForm}>Cancel edit</Button>}
          </div>
        </form>
      </Card>

      {message && <Card className="text-red-700" role="alert">{message}</Card>}
      {loading && <p className="text-gray-700">Loading resource records...</p>}

      <section className="space-y-4" aria-label="Resource records">
        <h2 className="text-xl font-semibold text-deep-plum">Resources</h2>
        {!loading && resources.length === 0 && <Card className="text-gray-700">No resources yet.</Card>}
        {resources.map((resource) => (
          <Card as="article" key={resource.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-deep-plum">{resource.name}</h3>
                <p className="text-sm text-gray-600">{kindLabels[resource.kind]} · {[resource.area, resource.city].filter(Boolean).join(", ")}</p>
              </div>
              <Badge variant={resource.published ? "mint" : "sky"}>{resource.published ? "Published" : "Unpublished"}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="text-sm" type="button" onClick={() => startEditing(resource)}>Edit</Button>
              <Button className="text-sm" type="button" disabled={busyId === resource.id} onClick={() => togglePublished(resource)}>
                {resource.published ? "Unpublish" : "Publish"}
              </Button>
              <Button variant="ghost" className="text-sm text-red-800" type="button" disabled={busyId === resource.id} onClick={() => deleteResource(resource)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-4" aria-label="Open resource suggestions">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-deep-plum">Open suggestions</h2>
          <Badge variant="lilac">{suggestions.length}</Badge>
        </div>
        {!loading && suggestions.length === 0 && <Card className="text-gray-700">No open suggestions.</Card>}
        {suggestions.map((suggestion) => (
          <Card as="article" key={suggestion.id} className="space-y-3">
            <p className="whitespace-pre-wrap text-gray-800">{suggestion.details}</p>
            <p className="text-xs text-gray-600">Suggested {new Date(suggestion.created_at).toLocaleDateString()}</p>
            <div className="flex flex-wrap gap-2">
              <Button className="text-sm" type="button" disabled={busyId === suggestion.id} onClick={() => updateSuggestion(suggestion, "added")}>
                Mark added
              </Button>
              <Button variant="secondary" className="text-sm" type="button" disabled={busyId === suggestion.id} onClick={() => updateSuggestion(suggestion, "dismissed")}>
                Dismiss
              </Button>
            </div>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}