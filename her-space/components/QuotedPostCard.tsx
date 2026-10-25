"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

type QuotedPostData = {
  id: string;
  title: string;
  body: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

type QuotedPostCardProps = {
  quotedPostId: string | null;
  quoted: QuotedPostData | QuotedPostData[] | null;
};

export default function QuotedPostCard({ quotedPostId, quoted }: QuotedPostCardProps) {
  const { t } = useLanguage();
  if (!quotedPostId) return null;

  const post = Array.isArray(quoted) ? quoted[0] : quoted;
  if (!post) {
    return <p className="break-words text-sm text-gray-500">{t("quote.unavailable")}</p>;
  }
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;

  return (
    <div className="space-y-1 rounded-lg border border-soft-lilac/70 bg-white/70 p-3">
      <p className="text-xs font-medium text-gray-500">{t("quote.label")}</p>
      <Link href={`/post/${post.id}`} className="block min-w-0 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle">
        <p className="break-words text-xs text-gray-600">{profile?.display_name || "Her Space member"}</p>
        <p className="line-clamp-1 break-words text-sm font-semibold text-deep-plum">{post.title}</p>
        <p className="line-clamp-2 break-words text-sm text-gray-600">{post.body}</p>
      </Link>
    </div>
  );
}
