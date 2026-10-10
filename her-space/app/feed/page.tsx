"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { navConfig } from "@/lib/nav";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import LikeButton from "@/components/LikeButton";
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

    if (currentUserId && incomingPosts.length > 0) {
      const postIds = incomingPosts.map((post) => post.id);
      const [likesResult, followsResult] = await Promise.all([
        supabase.from("likes").select("post_id, user_id").in("post_id", postIds),
        supabase.from("follows").select("followee_id").eq("follower_id", currentUserId),
      ]);

      if (likesResult.error) setMessage(friendlyError(likesResult.error, t));
      else {
        setLikeStates((current) => {
          const nextLikes = { ...current };
          for (const post of incomingPosts) {
            nextLikes[post.id] = { count: 0, liked: false };
          }
          for (const like of likesResult.data ?? []) {
            const state = nextLikes[like.post_id] ?? { count: 0, liked: false };
            state.count += 1;
            if (like.user_id === currentUserId) state.liked = true;
            nextLikes[like.post_id] = state;
          }
          return nextLikes;
        });
      }
      if (followsResult.error) setMessage(friendlyError(followsResult.error, t));
      else setFollowingIds((followsResult.data ?? []).map((follow) => follow.followee_id));
    } else {
      setLikeStates((current) => (reset ? {} : current));
      setFollowingIds([]);
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
                <Badge variant={typeVariants[post.type]}>
                  {t(typeTranslationKeys[post.type])}
                </Badge>
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
                  <a href={`/post/${post.id}`}>{post.title}</a>
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
                  {t("common.by")} <Link className="underline" href={`/u/${post.author_id}`}>{getAuthorName(post.profiles)}</Link>
                  {getProfessionalTitle(getAuthorProfile(post.profiles)) && (
                    <span className="rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                      {t("common.verifiedProfessional")} {getProfessionalTitle(getAuthorProfile(post.profiles))}
                    </span>
                  )}
                </p>
                <LikeButton
                  count={likeStates[post.id]?.count ?? 0}
                  liked={likeStates[post.id]?.liked ?? false}
                  onToggle={() => toggleLike(post.id)}
                />
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