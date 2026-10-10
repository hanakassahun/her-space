"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import PostSkeleton from "@/components/ui/PostSkeleton";
import BookmarkButton from "@/components/ui/BookmarkButton";
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
  sensitive: boolean;
  created_at: string;
  profiles: Profile | Profile[] | null;
};

type LikeState = { count: number; liked: boolean };
type ExploreRestoreState = {
  scrollY: number;
  pages: number;
  selectedTopic: string | null;
  search: string;
};

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
  const [restoreReady, setRestoreReady] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [savedPostIds, setSavedPostIds] = useState<Record<string, boolean>>({});
  const [savingPostIds, setSavingPostIds] = useState<Record<string, boolean>>({});
  const [revealedPostIds, setRevealedPostIds] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const restoreState = useRef<ExploreRestoreState | null>(null);
  const loadMoreLock = useRef(false);
  const loadMoreSentinel = useRef<HTMLDivElement>(null);
  const likeRequests = useRef(new Set<string>());
  const bookmarkRequests = useRef(new Set<string>());

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const restoreKey = window.sessionStorage.getItem("explore:return-key");
        const serialized = restoreKey ? window.sessionStorage.getItem(restoreKey) : null;
        if (serialized) {
          const saved = JSON.parse(serialized) as ExploreRestoreState;
          if (Number.isFinite(saved.scrollY) && Number.isInteger(saved.pages) && saved.pages > 0) {
            restoreState.current = saved;
            setSelectedTopic(saved.selectedTopic);
            setSearch(saved.search);
            setDebouncedSearch(saved.search);
          }
        }
      } catch {
        restoreState.current = null;
      }
      setRestoreReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function saveScrollForPost() {
    const key = `explore:${selectedTopic ?? "all"}:${encodeURIComponent(debouncedSearch)}`;
    try {
      window.sessionStorage.setItem(key, JSON.stringify({
        scrollY: window.scrollY,
        pages: page + 1,
        selectedTopic,
        search: debouncedSearch,
      }));
      window.sessionStorage.setItem("explore:return-key", key);
    } catch {
      // Ignore session storage errors.
    }
  }

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

  const loadPostsPage = useCallback(async (nextPage: number, reset: boolean) => {
    if (!userId || !authChecked) return;

    if (reset) setLoading(true);
    else setLoadingMore(true);
    setMessage("");

    let query = supabase
      .from("posts")
      .select(
        "id, author_id, type, provenance, sources, title, body, topics, sensitive, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))"
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
  }, [authChecked, debouncedSearch, selectedTopic, t, userId]);

  const loadPostsPageRef = useRef(loadPostsPage);
  useEffect(() => {
    loadPostsPageRef.current = loadPostsPage;
  }, [loadPostsPage]);

  useEffect(() => {
    if (!userId || !authChecked || !restoreReady) return;
    const timeout = window.setTimeout(() => {
      setPosts([]);
      setPage(0);
      setHasMore(true);
      void loadPostsPageRef.current(0, true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [authChecked, debouncedSearch, restoreReady, selectedTopic, userId]);

  const handleLoadMore = useCallback(async () => {
    if (loadMoreLock.current || loading || loadingMore || !hasMore) return;
    loadMoreLock.current = true;
    try {
      await loadPostsPage(page + 1, false);
    } finally {
      loadMoreLock.current = false;
    }
  }, [hasMore, loading, loadingMore, page, loadPostsPage]);

  const handleLoadMoreRef = useRef(handleLoadMore);
  useEffect(() => {
    handleLoadMoreRef.current = handleLoadMore;
  }, [handleLoadMore]);

  useEffect(() => {
    const saved = restoreState.current;
    if (!saved || loading || loadingMore || message) return;
    if (page + 1 < saved.pages && hasMore) {
      void handleLoadMoreRef.current();
      return;
    }

    restoreState.current = null;
    const key = `explore:${saved.selectedTopic ?? "all"}:${encodeURIComponent(saved.search)}`;
    try {
      window.sessionStorage.removeItem(key);
      window.sessionStorage.removeItem("explore:return-key");
    } catch {
      // Ignore session storage errors.
    }
    window.requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
  }, [hasMore, loading, loadingMore, message, page]);

  useEffect(() => {
    const sentinel = loadMoreSentinel.current;
    if (!sentinel || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void handleLoadMoreRef.current();
    }, { rootMargin: "400px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  async function toggleLike(postId: string) {
    if (!userId) {
      router.push("/login");
      return;
    }
    if (likeRequests.current.has(postId)) return;
    likeRequests.current.add(postId);
    const current = likeStates[postId] ?? { count: 0, liked: false };
    const optimistic = { count: current.count + (current.liked ? -1 : 1), liked: !current.liked };
    setLikeStates((states) => ({ ...states, [postId]: optimistic }));
    try {
      const result = current.liked
        ? await supabase.from("likes").delete().eq("user_id", userId).eq("post_id", postId)
        : await supabase.from("likes").insert({ post_id: postId });
      if (result.error) throw result.error;
    } catch (error) {
      setLikeStates((states) => ({ ...states, [postId]: current }));
      const friendlyMessage = friendlyError(error, t);
      setMessage(friendlyMessage);
      window.setTimeout(() => setMessage((currentMessage) => currentMessage === friendlyMessage ? "" : currentMessage), 3000);
    } finally {
      likeRequests.current.delete(postId);
    }
  }

  async function toggleBookmark(postId: string) {
    if (!userId) {
      router.push("/login");
      return;
    }
    if (bookmarkRequests.current.has(postId)) return;
    bookmarkRequests.current.add(postId);
    const isSaved = Boolean(savedPostIds[postId]);
    setSavedPostIds((current) => ({ ...current, [postId]: !isSaved }));
    setSavingPostIds((current) => ({ ...current, [postId]: true }));
    try {
      const result = isSaved
        ? await supabase.from("bookmarks").delete().eq("user_id", userId).eq("post_id", postId)
        : await supabase.from("bookmarks").insert({ post_id: postId });
      if (result.error) throw result.error;
    } catch (error) {
      setSavedPostIds((current) => ({ ...current, [postId]: isSaved }));
      const friendlyMessage = friendlyError(error, t);
      setMessage(friendlyMessage);
      window.setTimeout(() => setMessage((currentMessage) => currentMessage === friendlyMessage ? "" : currentMessage), 3000);
    } finally {
      bookmarkRequests.current.delete(postId);
      setSavingPostIds((current) => ({ ...current, [postId]: false }));
    }
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

        {loading && <div className="space-y-4">{[0, 1, 2].map((index) => <PostSkeleton key={index} />)}</div>}
        {message && <Card className="text-red-700">{message}</Card>}
        {!loading && !message && posts.length === 0 && (
          <Card className="text-gray-700">{t("explore.noResults")}</Card>
        )}

        <section className="space-y-4" aria-label="Explore results">
          {posts.map((post, index) => {
            const profile = first(post.profiles);
            const professionalTitle = getProfessionalTitle(profile);

            return (
              <Card
                as="article"
                key={post.id}
                className={`post-card space-y-4 ${page === 0 && index < 8 ? "post-entry" : ""}`}
                style={page === 0 && index < 8 ? { animationDelay: `${index * 40}ms` } : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant={typeVariants[post.type]}>
                      {t(typeTranslationKeys[post.type])}
                    </Badge>
                    <ProvenanceBadge provenance={post.provenance} sources={post.sources} short />
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
                    <Link href={`/post/${post.id}`} onClick={saveScrollForPost}>{post.title}</Link>
                  </h2>
                  {post.sensitive && !revealedPostIds[post.id] ? (
                    <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4" role="note">
                      <p className="text-sm text-rose-950">{t("read.sensitiveWarning")}</p>
                      <Button variant="secondary" type="button" onClick={() => setRevealedPostIds((current) => ({ ...current, [post.id]: true }))}>
                        {t("read.showPost")}
                      </Button>
                    </div>
                  ) : (
                    <PostBody body={post.body} href={`/post/${post.id}`} onNavigate={saveScrollForPost} />
                  )}
                </div>
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
                      onClick={saveScrollForPost}
                      aria-label={`${commentCounts[post.id] ?? 0} ${t("post.comments")}`}
                      title={t("post.comments")}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" />
                      </svg>
                      <span>{commentCounts[post.id] ?? 0}</span>
                    </Link>
                    <BookmarkButton
                      saved={Boolean(savedPostIds[post.id])}
                      disabled={savingPostIds[post.id] === true}
                      saveLabel={t("post.savePost")}
                      savedLabel={t("post.removeSaved")}
                      onToggle={() => void toggleBookmark(post.id)}
                      className="shrink-0 rounded-full text-gray-600 hover:bg-white/80 hover:text-deep-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        {loadingMore && <div className="space-y-4">{[0, 1, 2].map((index) => <PostSkeleton key={index} />)}</div>}
        {!loading && hasMore && posts.length > 0 && <div ref={loadMoreSentinel} className="h-px" aria-hidden="true" />}
        {!loading && !message && hasMore && posts.length > 0 && (
          <Button
            variant="secondary"
            className="w-full"
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
          >
            {t("common.loadMore")}
          </Button>
        )}
    </PageShell>
  );
}