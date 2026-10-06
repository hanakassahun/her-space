"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/components/LanguageProvider";

type Professional = { title: string } | { title: string }[] | null;
type Profile = {
  display_name: string | null;
  verified_professionals: Professional;
};

type Post = {
  id: string;
  type: "experience" | "question" | "knowledge";
  provenance: "personal" | "community" | "evidence";
  sources: string[];
  title: string;
  body: string;
  topics: string[];
  created_at: string;
  profiles: Profile | Profile[] | null;
};

type SavedPost = {
  savedAt: string;
  post: Post;
};

type BookmarkRow = {
  created_at: string;
  posts: Post | Post[] | null;
};

const typeVariants: Record<Post["type"], "rose" | "sky" | "mint"> = {
  experience: "rose",
  question: "sky",
  knowledge: "mint",
};

const typeTranslationKeys = {
  experience: "postType.experience",
  question: "postType.question",
  knowledge: "postType.knowledge",
} as const;

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function getProfessionalTitle(profile: Profile | null | undefined) {
  return first(profile?.verified_professionals ?? null)?.title;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function LibraryPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadLibrary() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      setUserId(authData.user.id);
      const { data, error } = await supabase
        .from("bookmarks")
        .select(
          "created_at, posts!bookmarks_post_id_fkey(id, type, provenance, sources, title, body, topics, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title)))"
        )
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        const rows = (data ?? []) as BookmarkRow[];
        setSavedPosts(
          rows.flatMap((row) => {
            const post = first(row.posts);
            return post ? [{ savedAt: row.created_at, post }] : [];
          })
        );
      }
      setLoading(false);
    }

    void loadLibrary();
  }, [router]);

  const topics = [...new Set(savedPosts.flatMap(({ post }) => post.topics ?? []))].sort(
    (left, right) => left.localeCompare(right)
  );
  const visiblePosts = selectedTopic
    ? savedPosts.filter(({ post }) => post.topics?.includes(selectedTopic))
    : savedPosts;

  async function unsavePost(postId: string) {
    if (!userId || busyPostId) return;

    setBusyPostId(postId);
    setMessage("");
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", postId);

    if (error) {
      setMessage(error.message);
    } else {
      setSavedPosts((current) => current.filter(({ post }) => post.id !== postId));
    }
    setBusyPostId(null);
  }

  return (
    <PageShell className="max-w-3xl space-y-8 px-4 py-6 md:px-6 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-deep-plum">{t("library.title")}</h1>
          </div>
        </header>

        {topics.length > 0 && (
          <nav className="flex flex-wrap gap-2" aria-label={t("library.filterLabel")}>
            <Button
              variant={selectedTopic === null ? "primary" : "secondary"}
              className="text-sm"
              type="button"
              onClick={() => setSelectedTopic(null)}
              aria-pressed={selectedTopic === null}
            >
              {t("library.allTopics")}
            </Button>
            {topics.map((topic) => (
              <Button
                variant={selectedTopic === topic ? "primary" : "secondary"}
                className="text-sm"
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                aria-pressed={selectedTopic === topic}
              >
                {topic}
              </Button>
            ))}
          </nav>
        )}

        {loading && <p className="text-gray-700">{t("library.loading")}</p>}
        {message && <Card className="text-red-700">{message}</Card>}
        {!loading && !message && savedPosts.length === 0 && (
          <Card className="text-gray-700">
            {t("library.empty")}
          </Card>
        )}
        {!loading && !message && savedPosts.length > 0 && visiblePosts.length === 0 && (
          <Card className="text-gray-700">
            {t("library.noMatch")}
          </Card>
        )}

        <section className="space-y-4" aria-label="Saved posts">
          {visiblePosts.map(({ post, savedAt }) => {
            const profile = first(post.profiles);
            const professionalTitle = getProfessionalTitle(profile);

            return (
              <Card as="article" key={post.id} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant={typeVariants[post.type]}>
                    {t(typeTranslationKeys[post.type])}
                  </Badge>
                  <time className="text-sm text-gray-500" dateTime={savedAt}>
                    {t("library.saved")} {formatDate(savedAt)}
                  </time>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    <Link href={`/post/${post.id}`}>{post.title}</Link>
                  </h2>
                  <p className="whitespace-pre-wrap text-gray-800">{post.body}</p>
                </div>

                <ProvenanceBadge provenance={post.provenance} sources={post.sources} />

                {post.topics?.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label={t("common.topics")}>
                    {post.topics.map((topic, index) => (
                      <li
                        className="rounded-full bg-soft-lilac px-2.5 py-1 text-xs text-deep-plum"
                        key={`${topic}-${index}`}
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose-100 pt-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    {t("common.by")} {profile?.display_name || "Her Space member"}
                    {professionalTitle && (
                      <span className="rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                        {t("common.verifiedProfessional")} {professionalTitle}
                      </span>
                    )}
                  </p>
                  <Button
                    variant="primary"
                    className="!h-11 !w-11 !min-w-11 !px-0 !py-0"
                    type="button"
                    onClick={() => unsavePost(post.id)}
                    disabled={busyPostId === post.id}
                    aria-label={t("library.unsave")}
                    title={busyPostId === post.id ? t("library.unsaving") : t("library.unsave")}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z" />
                    </svg>
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
    </PageShell>
  );
}