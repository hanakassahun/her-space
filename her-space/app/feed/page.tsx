"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { navConfig } from "@/lib/nav";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import LikeButton from "@/components/LikeButton";
import PostBody from "@/components/PostBody";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
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
type FeedRestoreState = { scrollY: number; pages: number; tab: "all" | "following" };

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

function getAuthorProfile(profiles: Post["profiles"]) {
  return Array.isArray(profiles) ? profiles[0] : profiles;
}

function getProfessionalTitle(profile: Profile | null | undefined) {
  const professional = profile?.verified_professionals;
  return (Array.isArray(professional) ? professional[0] : professional)?.title;
}

function getAuthorName(profiles: Post["profiles"]) {
  const profile = getAuthorProfile(profiles);
  return profile?.display_name || "Her Space member";
}

export default function FeedPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [savedPostIds, setSavedPostIds] = useState<Record<string, boolean>>({});
  const [savingPostIds, setSavingPostIds] = useState<Record<string, boolean>>({});
  const [revealedPostIds, setRevealedPostIds] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"all" | "following">("all");
  const [restoreReady, setRestoreReady] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const restoreState = useRef<FeedRestoreState | null>(null);
  const loadMoreLock = useRef(false);
  const loadMoreSentinel = useRef<HTMLDivElement>(null);
  const likeRequests = useRef(new Set<string>());
  const bookmarkRequests = useRef(new Set<string>());

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const restoreKey = window.sessionStorage.getItem("feed:return-key");
        const serialized = restoreKey ? window.sessionStorage.getItem(restoreKey) : null;
        if (serialized) {
          const saved = JSON.parse(serialized) as FeedRestoreState;
          if (Number.isFinite(saved.scrollY) && Number.isInteger(saved.pages) && saved.pages > 0) {
            restoreState.current = saved;
            setActiveTab(saved.tab);
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
    const key = `feed:${activeTab}`;
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ scrollY: window.scrollY, pages: page + 1, tab: activeTab }));
      window.sessionStorage.setItem("feed:return-key", key);
    } catch {
      // Ignore session storage errors.
    }
  }

  const loadPostsPage = useCallback(async (nextPage: number, reset: boolean) => {
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (reset) setLoading(true);
    else setLoadingMore(true);
    setMessage("");

    const [authResult, postsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("posts")
        .select("id, author_id, type, provenance, sources, title, body, topics, sensitive, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))")
        .order("created_at", { ascending: false })
        .range(from, to),
    ]);

    const currentUserId = authResult.data.user?.id ?? null;
    setUserId(currentUserId);
    setIsSignedIn(Boolean(currentUserId));

    if (postsResult.error) {
      setMessage(friendlyError(postsResult.error, t));
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const incomingPosts = (postsResult.data ?? []) as Post[];
    const nextPosts = reset ? incomingPosts : mergeUniquePosts(posts, incomingPosts);
    setPosts(nextPosts);
    setHasMore(incomingPosts.length === PAGE_SIZE);
    setPage(nextPage);

    if (incomingPosts.length > 0) {
      const postIds = incomingPosts.map((post) => post.id);
      const [likesResult, commentsResult] = await Promise.all([
        supabase.from("likes").select("post_id, user_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
      ]);

      if (likesResult.error) setMessage(friendlyError(likesResult.error, t));
      else {
        setLikeStates((current) => {
          const nextLikes = reset ? {} : { ...current };
          for (const post of incomingPosts) {
            nextLikes[post.id] = { count: 0, liked: false };
          }
          for (const like of likesResult.data ?? []) {
            const state = nextLikes[like.post_id] ?? { count: 0, liked: false };
            state.count += 1;
            if (currentUserId && like.user_id === currentUserId) state.liked = true;
            nextLikes[like.post_id] = state;
          }
          return nextLikes;
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

      if (currentUserId) {
        const [followsResult, bookmarksResult] = await Promise.all([
          supabase.from("follows").select("followee_id").eq("follower_id", currentUserId),
          supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
        ]);
        if (followsResult.error) setMessage(friendlyError(followsResult.error, t));
        else setFollowingIds((followsResult.data ?? []).map((follow) => follow.followee_id));
        if (bookmarksResult.error) setMessage(friendlyError(bookmarksResult.error, t));
        else {
          setSavedPostIds((current) => {
            const saved = reset ? {} : { ...current };
            for (const post of incomingPosts) saved[post.id] = false;
            for (const bookmark of bookmarksResult.data ?? []) saved[bookmark.post_id] = true;
            return saved;
          });
        }
      } else {
        setFollowingIds([]);
        setSavedPostIds((current) => {
          const saved = reset ? {} : { ...current };
          for (const post of incomingPosts) saved[post.id] = false;
          return saved;
        });
      }
    } else {
      if (reset) {
        setLikeStates({});
        setCommentCounts({});
        setSavedPostIds({});
        setFollowingIds([]);
      }
    }

    setLoading(false);
    setLoadingMore(false);
  }, [posts, t]);

  const loadPostsPageRef = useRef(loadPostsPage);
  useEffect(() => {
    loadPostsPageRef.current = loadPostsPage;
  }, [loadPostsPage]);

  useEffect(() => {
    if (!restoreReady) return;
    const timeout = window.setTimeout(() => void loadPostsPageRef.current(0, true), 0);
    return () => window.clearTimeout(timeout);
  }, [activeTab, restoreReady]);

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

  const visiblePosts = activeTab === "following"
    ? posts.filter((post) => followingIds.includes(post.author_id))
    : posts;

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
    try {
      window.sessionStorage.removeItem(`feed:${saved.tab}`);
      window.sessionStorage.removeItem("feed:return-key");
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

  return (
    <PageShell className="max-w-3xl space-y-8 px-4 py-6 md:px-6 md:py-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-deep-plum">{t("feed.title")}</h1>
          </div>
          <Link
            className="gradient-aurora shadow-glow inline-flex min-h-11 shrink-0 items-center rounded-full px-5 py-2 font-medium text-white"
            href={navConfig.write.href}
          >
            {t("nav.writePost")}
          </Link>
        </header>

        <nav className="flex gap-2" aria-label={t("feed.posts")}>
          <Button
            variant={activeTab === "all" ? "primary" : "secondary"}
            className="text-sm"
            type="button"
            aria-pressed={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          >
            {t("feed.all")}
          </Button>
          <Button
            variant={activeTab === "following" ? "primary" : "secondary"}
            className="text-sm"
            type="button"
            aria-pressed={activeTab === "following"}
            onClick={() => {
              if (!isSignedIn) router.push("/login");
              else setActiveTab("following");
            }}
          >
            {t("feed.following")}
          </Button>
        </nav>

        {loading && <div className="space-y-4">{[0, 1, 2].map((index) => <PostSkeleton key={index} />)}</div>}
        {message && <Card className="text-red-700">{message}</Card>}
        {!loading && !message && visiblePosts.length === 0 && (
          <Card className="space-y-3 text-gray-700">
            <p>{activeTab === "following" ? t("feed.noFollowing") : t("feed.noPosts")}</p>
            {activeTab === "following" && (
              <p className="text-sm text-gray-600">{t("empty.followingHint")}</p>
            )}
            <Button
              type="button"
              onClick={() => activeTab === "following" ? setActiveTab("all") : router.push("/new")}
            >
              {activeTab === "following" ? t("empty.browseFeed") : t("empty.writeFirst")}
            </Button>
          </Card>
        )}

        <section className="space-y-4" aria-label="Posts">
          {visiblePosts.map((post, index) => (
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
                    {getAuthorName(post.profiles).trim().charAt(0).toLocaleUpperCase() || "H"}
                  </span>
                  <span className="min-w-0 break-words">
                    {t("common.by")} <Link className="underline" href={`/u/${post.author_id}`}>{getAuthorName(post.profiles)}</Link>
                  {getProfessionalTitle(getAuthorProfile(post.profiles)) && (
                    <span className="ml-2 inline-flex rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                      {t("common.verifiedProfessional")} {getProfessionalTitle(getAuthorProfile(post.profiles))}
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
          ))}
        </section>

        {loadingMore && <div className="space-y-4">{[0, 1, 2].map((index) => <PostSkeleton key={index} />)}</div>}
        {!loading && hasMore && visiblePosts.length > 0 && <div ref={loadMoreSentinel} className="h-px" aria-hidden="true" />}
        {!loading && !message && hasMore && visiblePosts.length > 0 && (
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