"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ResourcesPage() {
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState<ResourceKind | "all">("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadResources() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("resources")
        .select("id, name, kind, city, area, services, approx_cost, phone, address, notes, last_verified")
        .eq("published", true)
        .order("city", { ascending: true })
        .order("name", { ascending: true });

      if (error) setMessage(error.message);
      else setResources((data ?? []) as Resource[]);
      setLoading(false);
    }

    void loadResources();
  }, [router]);

  const areas = useMemo(
    () => [...new Set(resources.map((resource) => resource.area?.trim()).filter((area): area is string => Boolean(area)))].sort(),
    [resources]
  );

  const filteredResources = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return resources.filter((resource) => {
      const matchesKind = selectedKind === "all" || resource.kind === selectedKind;
      const matchesArea = selectedArea === "all" || resource.area === selectedArea;
      const searchable = [
        resource.name,
        resource.city,
        resource.area ?? "",
        resource.address ?? "",
        resource.notes ?? "",
        ...resource.services,
      ].join(" ").toLocaleLowerCase();
      return matchesKind && matchesArea && (!term || searchable.includes(term));
    });
  }, [resources, search, selectedArea, selectedKind]);

  async function submitSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || suggestion.trim().length < 5) return;

    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.from("resource_suggestions").insert({
      details: suggestion.trim(),
    });

    if (error) setMessage(error.message);
    else {
      setSuggestion("");
      setMessage("Thank you. Your suggestion has been sent for review.");
    }
    setSubmitting(false);
  }

  return (
    <PageShell className="max-w-4xl space-y-7 px-4 py-6 md:px-6 md:py-10">
      <header>
        <h1 className="text-3xl font-bold text-deep-plum">Care & support resources</h1>
        <p className="mt-1 text-sm text-gray-700">Find nearby services and ways to get support.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Input
          type="search"
          placeholder="Search name, service, or location"
          aria-label="Search resources"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="min-h-11 rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 text-deep-plum focus:outline-none focus:ring-2 focus:ring-soft-lilac"
          aria-label="Filter by kind"
          value={selectedKind}
          onChange={(event) => setSelectedKind(event.target.value as ResourceKind | "all")}
        >
          <option value="all">All kinds</option>
          {Object.entries(kindLabels).map(([kind, label]) => (
            <option key={kind} value={kind}>{label}</option>
          ))}
        </select>
        <select
          className="min-h-11 rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 text-deep-plum focus:outline-none focus:ring-2 focus:ring-soft-lilac"
          aria-label="Filter by area"
          value={selectedArea}
          onChange={(event) => setSelectedArea(event.target.value)}
        >
          <option value="all">All areas</option>
          {areas.map((area) => <option key={area} value={area}>{area}</option>)}
        </select>
      </div>

      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
        Costs and details change. Call to confirm.
      </p>

      {loading && <p className="text-gray-700">Loading resources...</p>}
      {message && <Card className="text-deep-plum" role="status">{message}</Card>}
      {!loading && !message && filteredResources.length === 0 && (
        <Card className="text-gray-700">No resources match your filters.</Card>
      )}

      <section className="grid gap-4 md:grid-cols-2" aria-label="Published resources">
        {filteredResources.map((resource) => (
          <Card as="article" key={resource.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-deep-plum">{resource.name}</h2>
              <Badge variant="lilac">{kindLabels[resource.kind]}</Badge>
            </div>
            <p className="text-sm text-gray-700">
              {[resource.area, resource.city].filter(Boolean).join(", ")}
            </p>
            {resource.services.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Services">
                {resource.services.map((service) => (
                  <li key={service}><Badge variant="sky">{service}</Badge></li>
                ))}
              </ul>
            )}
            {resource.approx_cost && (
              <p className="text-sm text-gray-800"><span className="font-medium">Approximate cost:</span> {resource.approx_cost}</p>
            )}
            {resource.phone && (
              <p className="text-sm">
                <a className="font-medium text-teal-900 underline" href={`tel:${resource.phone.replace(/[^\d+]/g, "")}`}>
                  {resource.phone}
                </a>
              </p>
            )}
            {resource.address && <p className="whitespace-pre-wrap text-sm text-gray-700">{resource.address}</p>}
            {resource.notes && <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{resource.notes}</p>}
            {resource.last_verified && (
              <p className="border-t border-white/70 pt-3 text-xs text-gray-600">
                Last verified {formatDate(resource.last_verified)}
              </p>
            )}
          </Card>
        ))}
      </section>

      <Card as="section" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-deep-plum">Suggest a place or correction</h2>
          <p className="mt-1 text-sm text-gray-700">Tell us what should be added or updated.</p>
        </div>
        <form className="space-y-3" onSubmit={submitSuggestion}>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Suggestion
            <Textarea
              className="min-h-28"
              value={suggestion}
              onChange={(event) => setSuggestion(event.target.value)}
              minLength={5}
              maxLength={1000}
              required
              placeholder="Include the place name, location, or correction details."
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-gray-600">{suggestion.length}/1000</span>
            <Button type="submit" disabled={submitting || suggestion.trim().length < 5}>
              {submitting ? "Sending..." : "Send suggestion"}
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  );
}