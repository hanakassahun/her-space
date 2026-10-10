"use client";

import { useEffect, useState } from "react";
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
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "following">("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");

  async function loadPostsPage(nextPage: number, reset: boolean) {
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (reset) setLoading(true);
    else setLoadingMore(true);
    setMessage("");

    const [authResult, postsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("posts")
        .select("id, author_id, type, provenance, sources, title, body, topics, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))")
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
  }

  useEffect(() => {
    void loadPostsPage(0, true);
  }, [activeTab]);

  async function toggleLike(postId: string) {
    if (!userId) {
      router.push("/login");
      return;
    }
    const current = likeStates[postId] ?? { count: 0, liked: false };
    const result = current.liked
      ? await supabase.from("likes").delete().eq("user_id", userId).eq("post_id", postId)
      : await supabase.from("likes").insert({ post_id: postId });

    if (result.error) {
      setMessage(friendlyError(result.error, t));
    } else {
      setLikeStates((states) => ({
        ...states,
        [postId]: {
          count: current.count + (current.liked ? -1 : 1),
          liked: !current.liked,
        },
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

  const visiblePosts = activeTab === "following"
    ? posts.filter((post) => followingIds.includes(post.author_id))
    : posts;

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    await loadPostsPage(page + 1, false);
  }

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

        {loading && <p className="text-gray-700">{t("feed.loading")}</p>}
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
          {visiblePosts.map((post) => (
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
          ))}
        </section>

        {!loading && !message && hasMore && visiblePosts.length > 0 && (
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