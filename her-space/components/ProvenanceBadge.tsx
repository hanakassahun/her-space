type Provenance = "personal" | "community" | "evidence";

type ProvenanceBadgeProps = {
  provenance: Provenance;
  sources?: string[];
};

const badgeStyles: Record<Provenance, string> = {
  personal: "bg-rose-100 text-rose-800",
  community: "bg-amber-100 text-amber-800",
  evidence: "bg-teal-100 text-teal-800",
};

const labels: Record<Provenance, string> = {
  personal: "Personal experience",
  community: "Community knowledge, not medically verified",
  evidence: "Evidence-backed",
};

export default function ProvenanceBadge({ provenance, sources = [] }: ProvenanceBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`rounded px-2.5 py-1 text-xs font-medium ${badgeStyles[provenance]}`}>
        {labels[provenance]}
      </span>
      {provenance === "evidence" && sources.map((source, index) => (
        <a
          className="text-xs text-teal-800 underline"
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