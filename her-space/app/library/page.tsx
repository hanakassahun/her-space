"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PostSkeleton from "@/components/ui/PostSkeleton";
import BookmarkButton from "@/components/ui/BookmarkButton";
import UserText from "@/components/UserText";
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
  sensitive: boolean;
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
  const [message, setMessage] = useState("");
  const [busyPostIds, setBusyPostIds] = useState<Record<string, boolean>>({});
  const [revealedPostIds, setRevealedPostIds] = useState<Record<string, boolean>>({});
  const bookmarkRequests = useRef(new Set<string>());

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
          "created_at, posts!bookmarks_post_id_fkey(id, type, provenance, sources, title, body, topics, sensitive, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title)))"
        )
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(friendlyError(error, t));
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
    if (!userId || bookmarkRequests.current.has(postId)) return;

    const originalIndex = savedPosts.findIndex(({ post }) => post.id === postId);
    const original = savedPosts[originalIndex];
    if (!original) return;

    bookmarkRequests.current.add(postId);
    setBusyPostIds((current) => ({ ...current, [postId]: true }));
    setMessage("");
    setSavedPosts((current) => current.filter(({ post }) => post.id !== postId));
    try {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("post_id", postId);
      if (error) throw error;
    } catch (error) {
      setSavedPosts((current) => {
        if (current.some(({ post }) => post.id === postId)) return current;
        const restored = [...current];
        restored.splice(Math.min(originalIndex, restored.length), 0, original);
        return restored;
      });
      const friendlyMessage = friendlyError(error, t);
      setMessage(friendlyMessage);
      window.setTimeout(() => setMessage((currentMessage) => currentMessage === friendlyMessage ? "" : currentMessage), 3000);
    } finally {
      bookmarkRequests.current.delete(postId);
      setBusyPostIds((current) => ({ ...current, [postId]: false }));
    }
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

        {loading && <div className="space-y-4">{[0, 1, 2].map((index) => <PostSkeleton key={index} />)}</div>}
        {message && <Card className="text-red-700">{message}</Card>}
        {!loading && !message && savedPosts.length === 0 && (
          <Card className="space-y-3 text-gray-700">
            <p>{t("library.empty")}</p>
            <p className="text-sm text-gray-600">{t("empty.libraryHint")}</p>
            <Button type="button" onClick={() => router.push("/feed")}>
              {t("empty.browseFeed")}
            </Button>
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
              <Card as="article" key={post.id} className="post-card space-y-4">
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
                  {post.sensitive && !revealedPostIds[post.id] ? (
                    <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4" role="note">
                      <p className="text-sm text-rose-950">{t("read.sensitiveWarning")}</p>
                      <Button variant="secondary" type="button" onClick={() => setRevealedPostIds((current) => ({ ...current, [post.id]: true }))}>
                        {t("read.showPost")}
                      </Button>
                    </div>
                  ) : (
                    <UserText text={post.body} className="text-gray-800" />
                  )}
                </div>

                <ProvenanceBadge provenance={post.provenance} sources={post.sources} />

                {(!post.sensitive || revealedPostIds[post.id]) && post.topics?.length > 0 && (
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
                  <BookmarkButton
                    saved
                    disabled={busyPostIds[post.id] === true}
                    saveLabel={t("post.savePost")}
                    savedLabel={t("library.unsave")}
                    onToggle={() => void unsavePost(post.id)}
                    variant="primary"
                  />
                </div>
              </Card>
            );
          })}
        </section>
    </PageShell>
  );
}