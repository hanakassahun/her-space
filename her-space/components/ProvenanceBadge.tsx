import Badge from "@/components/ui/Badge";

type Provenance = "personal" | "community" | "evidence";

type ProvenanceBadgeProps = {
  provenance: Provenance;
  sources?: string[];
};

const badgeVariants: Record<Provenance, "rose" | "lilac" | "mint"> = {
  personal: "rose",
  community: "lilac",
  evidence: "mint",
};

const labels: Record<Provenance, string> = {
  personal: "Personal experience",
  community: "Community knowledge, not medically verified",
  evidence: "Evidence-backed",
};

export default function ProvenanceBadge({ provenance, sources = [] }: ProvenanceBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={badgeVariants[provenance]} className="border border-current/25 font-semibold">
        {labels[provenance]}
      </Badge>
      {provenance === "evidence" && sources.map((source, index) => (
        <a
          className="text-xs font-medium text-emerald-900 underline"
          href={source}
          key={`${source}-${index}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Source {index + 1}
        </a>
      ))}
    </div>
  );
}