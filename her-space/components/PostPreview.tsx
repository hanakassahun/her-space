"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import UserText from "@/components/UserText";
import type { TranslationKey } from "@/lib/i18n/en";

type PostType = "experience" | "question" | "knowledge";
type Provenance = "personal" | "community" | "evidence";

type PostPreviewProps = {
  type: PostType;
  provenance: Provenance;
  sources: string[];
  title: string;
  body: string;
  topics: string[];
  sensitive: boolean;
  t: (key: TranslationKey) => string;
  onKeepEditing: () => void;
};

const typeTranslationKeys: Record<PostType, TranslationKey> = {
  experience: "new.experience",
  question: "new.question",
  knowledge: "new.knowledge",
};

export default function PostPreview({
  type,
  provenance,
  sources,
  title,
  body,
  topics,
  sensitive,
  t,
  onKeepEditing,
}: PostPreviewProps) {
  return (
    <div className="space-y-4">
      <Card as="article" className="post-card space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={type === "experience" ? "rose" : type === "question" ? "sky" : "mint"}>
            {t(typeTranslationKeys[type])}
          </Badge>
          <ProvenanceBadge provenance={provenance} sources={sources} />
        </div>
        <div className="space-y-2">
          <h2 className="break-words text-xl font-semibold text-gray-900">{title || t("common.title")}</h2>
          <UserText text={body} className="min-h-6 text-gray-800" />
        </div>
        {topics.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={t("common.topics")}>
            {topics.map((topic) => <li key={topic}><Badge variant="lilac">{topic}</Badge></li>)}
          </ul>
        )}
        {sensitive && <p className="text-sm text-gray-600">{t("write.sensitive")}</p>}
      </Card>
      <Button variant="secondary" type="button" onClick={onKeepEditing}>
        {t("write.keepEditing")}
      </Button>
    </div>
  );
}
