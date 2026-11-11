"use client";

import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { useLanguage } from "@/components/LanguageProvider";

type PostType = "experience" | "question" | "knowledge";

const variants: Record<PostType, "rose" | "sky" | "mint"> = {
  experience: "rose",
  question: "sky",
  knowledge: "mint",
};

const translationKeys = {
  experience: "postType.experience",
  question: "postType.question",
  knowledge: "postType.knowledge",
} as const;

export default function PostTypeBadgeLink({ type }: { type: PostType }) {
  const { t } = useLanguage();
  return (
    <Link
      href={`/explore?type=${type}`}
      aria-label={t("explore.seeMoreLike")}
      className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Badge variant={variants[type]}>{t(translationKeys[type])}</Badge>
    </Link>
  );
}
