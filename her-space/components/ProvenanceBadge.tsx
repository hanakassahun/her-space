import Badge from "@/components/ui/Badge";
import { useLanguage } from "@/components/LanguageProvider";

type Provenance = "personal" | "community" | "evidence";

type ProvenanceBadgeProps = {
  provenance: Provenance;
  sources?: string[];
  short?: boolean;
};

const badgeVariants: Record<Provenance, "rose" | "lilac" | "mint"> = {
  personal: "rose",
  community: "lilac",
  evidence: "mint",
};

const labelKeys = {
  personal: "provenance.personal",
  community: "provenance.community",
  evidence: "provenance.evidence",
} as const;

const shortLabelKeys = {
  personal: "provenance.personalShort",
  community: "provenance.communityShort",
  evidence: "provenance.evidenceShort",
} as const;

export default function ProvenanceBadge({ provenance, sources = [], short = false }: ProvenanceBadgeProps) {
  const { t } = useLanguage();
  const fullLabel = t(labelKeys[provenance]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={badgeVariants[provenance]} className="border border-current/25 font-semibold" title={short ? fullLabel : undefined}>
        {short ? t(shortLabelKeys[provenance]) : fullLabel}
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