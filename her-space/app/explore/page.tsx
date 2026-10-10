"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import LikeButton from "@/components/LikeButton";
import PostBody from "@/components/PostBody";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/components/LanguageProvider";

type Professional = { title: string } | { title: string }[] | null;
type Profile = {
  display_name: string | null;
  verified_professionals: Professional;
};
type Post = {
  id: string;
  author_id: string;
  type: "experience" | "question" | "knowledge";
  provenance: "personal" | "community" | "evidence";
  sources: string[];
  title: string;
  body: string;
  topics: string[];
  created_at: string;
  profiles: Profile | Profile[] | null;
};

type LikeState = { count: number; liked: boolean };

const topicGroups = {
  Health: [
    "periods",
    "hormones",
    "PCOS",
    "fertility",
    "contraception",
    "sexual health",
    "breast health",
  ],
  "Body & Beauty": ["skin", "hair", "hygiene"],
  "Mind & Life": ["mental health", "relationships", "confidence"],
  "Life stages": ["puberty", "pregnancy", "postpartum", "menopause"],
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

const PAGE_SIZE = 20;

function mergeUniquePosts(current: Post[], incoming: Post[]) {
  const merged = new Map(current.map((post) => [post.id, post]));
  incoming.forEach((post) => merged.set(post.id, post));
  return [...merged.values()];
}

const topicGroupTranslationKeys = {
  Health: "explore.health",
  "Body & Beauty": "explore.bodyBeauty",
  "Mind & Life": "explore.mindLife",
  "Life stages": "explore.lifeStages",
} as const;

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function getProfessionalTitle(profile: Profile | null | undefined) {
  return first(profile?.verified_professionals ?? null)?.title;
}

export default function ExplorePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [savedPostIds, setSavedPostIds] = useState<Record<string, boolean>>({});
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setAuthChecked(true);
    }
    void checkAuth();
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  async function loadPostsPage(nextPage: number, reset: boolean) {
    if (!userId || !authChecked) return;

    if (reset) setLoading(true);
    else setLoadingMore(true);
    setMessage("");

    let query = supabase
      .from("posts")
      .select(
        "id, author_id, type, provenance, sources, title, body, topics, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))"
      )
      .order("created_at", { ascending: false })
      .range(nextPage * PAGE_SIZE, nextPage * PAGE_SIZE + PAGE_SIZE - 1);

    if (debouncedSearch) {
      const safeTerm = debouncedSearch.replace(/[%,()]/g, " ").replace(/\s+/g, " ");
      if (safeTerm.trim()) {
        query = query.or(
          `title.ilike.%${safeTerm.trim()}%,body.ilike.%${safeTerm.trim()}%`
        );
      }
    }
    if (selectedTopic) query = query.contains("topics", [selectedTopic]);

    const { data, error } = await query;
    if (error) {
      setMessage(friendlyError(error, t));
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const incomingPosts = (data ?? []) as Post[];
    setPosts((current) => (reset ? incomingPosts : mergeUniquePosts(current, incomingPosts)));
    const postIds = incomingPosts.map((post) => post.id);
    if (postIds.length > 0 && userId) {
      const [likesResult, commentsResult, bookmarksResult] = await Promise.all([
        supabase.from("likes").select("post_id, user_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        supabase.from("bookmarks").select("post_id").eq("user_id", userId).in("post_id", postIds),
      ]);

      if (likesResult.error) setMessage(friendlyError(likesResult.error, t));
      else {
        setLikeStates((current) => {
          const next = reset ? {} : { ...current };
          for (const post of incomingPosts) next[post.id] = { count: 0, liked: false };
          for (const like of likesResult.data ?? []) {
            const state = next[like.post_id] ?? { count: 0, liked: false };
            state.count += 1;
            if (like.user_id === userId) state.liked = true;
            next[like.post_id] = state;
          }
          return next;
        });
      }
      if (!commentsResult.error) {
        setCommentCounts((current) => {
          const counts = reset ? {} : { ...current };
          for (const post of incomingPosts) counts[post.id] = 0;
          for (const comment of commentsResult.data ?? []) {
            counts[comment.post_id] = (counts[comment.post_id] ?? 0) + 1;
          }
          return counts;
        });
      }
      if (bookmarksResult.error) setMessage(friendlyError(bookmarksResult.error, t));
      else {
        setSavedPostIds((current) => {
          const saved = reset ? {} : { ...current };
          for (const post of incomingPosts) saved[post.id] = false;
          for (const bookmark of bookmarksResult.data ?? []) saved[bookmark.post_id] = true;
          return saved;
        });
      }
    } else if (reset) {
      setLikeStates({});
      setCommentCounts({});
      setSavedPostIds({});
    }
    setHasMore(incomingPosts.length === PAGE_SIZE);
    setPage(nextPage);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    if (!userId || !authChecked) return;
    setPosts([]);
    setPage(0);
    setHasMore(true);
    void loadPostsPage(0, true);
  }, [authChecked, debouncedSearch, selectedTopic, userId]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    await loadPostsPage(page + 1, false);
  }

  async function toggleLike(postId: string) {
    if (!userId) {
      router.push("/login");
      return;
    }
    const current = likeStates[postId] ?? { count: 0, liked: false };
    const result = current.liked
      ? await supabase.from("likes").delete().eq("user_id", userId).eq("post_id", postId)
      : await supabase.from("likes").insert({ post_id: postId });
    if (result.error) setMessage(friendlyError(result.error, t));
    else {
      setLikeStates((states) => ({
        ...states,
        [postId]: { count: current.count + (current.liked ? -1 : 1), liked: !current.liked },
      }));
    }
  }

  async function toggleBookmark(postId: string) {
    if (!userId) {
      router.push("/login");
      return;
    }
    if (savingPostId) return;
    setSavingPostId(postId);
    const isSaved = Boolean(savedPostIds[postId]);
    const result = isSaved
      ? await supabase.from("bookmarks").delete().eq("user_id", userId).eq("post_id", postId)
      : await supabase.from("bookmarks").insert({ post_id: postId });
    if (result.error) setMessage(friendlyError(result.error, t));
    else setSavedPostIds((current) => ({ ...current, [postId]: !isSaved }));
    setSavingPostId(null);
  }

  return (
    <PageShell className="max-w-3xl space-y-8 px-4 py-6 md:px-6 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-deep-plum">{t("explore.title")}</h1>
          </div>
        </header>

        <Input
          className="min-h-12 rounded-full shadow-sm"
          type="search"
          placeholder={t("explore.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("explore.searchLabel")}
        />

        <div className="space-y-4">
          {Object.entries(topicGroups).map(([heading, topics]) => (
            <section className="space-y-2" key={heading} aria-label={heading}>
              <h2 className="text-sm font-semibold text-deep-plum">{t(topicGroupTranslationKeys[heading as keyof typeof topicGroupTranslationKeys])}</h2>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <Button
                    variant={selectedTopic === topic ? "primary" : "secondary"}
                    className="text-sm"
                    key={topic}
                    type="button"
                    aria-pressed={selectedTopic === topic}
                    onClick={() =>
                      setSelectedTopic((current) => (current === topic ? null : topic))
                    }
                  >
                    {topic}
                  </Button>
                ))}
              </div>
            </section>
          ))}
          {selectedTopic && (
            <Button
              variant="ghost"
              className="text-sm"
              type="button"
              onClick={() => setSelectedTopic(null)}
            >
              {t("explore.clearFilter")}
            </Button>
          )}
        </div>

        {loading && <p className="text-gray-700">{t("explore.searching")}</p>}
        {message && <Card className="text-red-700">{message}</Card>}
        {!loading && !message && posts.length === 0 && (
          <Card className="text-gray-700">{t("explore.noResults")}</Card>
        )}

        <section className="space-y-4" aria-label="Explore results">
          {posts.map((post) => {
            const profile = first(post.profiles);
            const professionalTitle = getProfessionalTitle(profile);

            return (
              <Card as="article" key={post.id} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant={typeVariants[post.type]}>
                      {t(typeTranslationKeys[post.type])}
                    </Badge>
                    <ProvenanceBadge provenance={post.provenance} sources={post.sources} />
                  </div>
                  <time className="text-sm text-gray-500" dateTime={post.created_at}>
                    {new Date(post.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    <Link href={`/post/${post.id}`}>{post.title}</Link>
                  </h2>
                  <PostBody body={post.body} href={`/post/${post.id}`} />
                </div>
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
                <div className="flex flex-col gap-3 border-t border-rose-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
                    <span className="gradient-aurora flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" aria-hidden="true">
                      {(profile?.display_name || "Her Space member").trim().charAt(0).toLocaleUpperCase() || "H"}
                    </span>
                    <span className="min-w-0 break-words">
                      {t("common.by")} {" "}
                      <Link className="underline" href={`/u/${post.author_id}`}>
                        {profile?.display_name || "Her Space member"}
                      </Link>
                      {professionalTitle && (
                        <span className="ml-2 inline-flex rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                          {t("common.verifiedProfessional")} {professionalTitle}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                    <LikeButton
                      count={likeStates[post.id]?.count ?? 0}
                      liked={likeStates[post.id]?.liked ?? false}
                      onToggle={() => toggleLike(post.id)}
                    />
                    <Link
                      className="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-sm text-gray-600 hover:bg-white/80 hover:text-deep-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                      href={`/post/${post.id}#comments-heading`}
                      aria-label={`${commentCounts[post.id] ?? 0} ${t("post.comments")}`}
                      title={t("post.comments")}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" />
                      </svg>
                      <span>{commentCounts[post.id] ?? 0}</span>
                    </Link>
                    <button
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-white/80 hover:text-deep-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                      type="button"
                      onClick={() => void toggleBookmark(post.id)}
                      disabled={savingPostId === post.id}
                      aria-label={t(savedPostIds[post.id] ? "post.removeSaved" : "post.savePost")}
                      aria-pressed={Boolean(savedPostIds[post.id])}
                      title={t(savedPostIds[post.id] ? "post.removeSaved" : "post.savePost")}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill={savedPostIds[post.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        {!loading && !message && hasMore && posts.length > 0 && (
          <Button
            variant="secondary"
            className="w-full"
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : t("common.loadMore")}
          </Button>
        )}
    </PageShell>
  );
}