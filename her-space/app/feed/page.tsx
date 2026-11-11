"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { attachQuoted, type QuotedPost } from "@/lib/quoted";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
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
import PostTypeBadgeLink from "@/components/PostTypeBadgeLink";
import { useLanguage } from "@/components/LanguageProvider";
import TimeAgo from "@/components/TimeAgo";
import { useAuth } from "@/components/AuthProvider";
import RepostButton from "@/components/RepostButton";
import QuotedPostCard from "@/components/QuotedPostCard";
import Avatar from "@/components/Avatar";
import PollCard from "@/components/PollCard";
import { loadPollResults, type PollResult } from "@/lib/polls";
import DoubleTapLikeArea from "@/components/DoubleTapLikeArea";
import CoverArt from "@/components/CoverArt";
import DecorativeEmptyArt from "@/components/DecorativeEmptyArt";
import { useSwipeTabs } from "@/lib/useSwipeTabs";

type Professional = { title: string } | { title: string }[] | null;
type Profile = {
  display_name: string | null;
  avatar: string | null;
  verified_professionals: Professional;
};

type Post = {
  id: string;
  cover: string | null;
  author_id: string;
  type: "experience" | "question" | "knowledge";
  provenance: "personal" | "community" | "evidence";
  audience: "all" | "adult";
  like_count: number;
  allow_reposts: boolean;
  quoted_post_id: string | null;
  quoted: QuotedPost | null;
  sources: string[];
  title: string;
  body: string;
  is_series_opener: boolean;
  series_root_id: string | null;
  series_position: number | null;
  series_cadence: "daily" | "weekly" | "monthly" | "whenever" | null;
  series_status: "active" | "paused" | "finished" | null;
  topics: string[];
  sensitive: boolean;
  is_quick: boolean;
  has_poll: boolean;
  poll_closes_at: string | null;
  created_at: string;
  profiles: Profile | Profile[] | null;
};

type LikeState = { count: number; liked: boolean };
type FeedTab = "forYou" | "latest" | "following";
type RecommendationReason = "follow" | "interest" | "popular" | "recent";
type FeedRestoreState = { scrollY: number; pages: number; tab: FeedTab };
type FollowingFeedRow = { kind: "post" | "repost"; post_id: string; reposter_id: string | null; happened_at: string };
type FollowingItem = FollowingFeedRow & { key: string };
type ReposterProfile = { id: string; display_name: string | null; avatar: string | null };

const feedTabLabels = {
  forYou: "feed.forYou",
  latest: "feed.latest",
  following: "feed.following",
} as const;
const FEED_TABS = Object.keys(feedTabLabels) as FeedTab[];

const reasonTranslationKeys: Record<RecommendationReason, "feed.whyFollow" | "feed.whyInterest" | "feed.whyPopular" | "feed.whyRecent"> = {
  follow: "feed.whyFollow",
  interest: "feed.whyInterest",
  popular: "feed.whyPopular",
  recent: "feed.whyRecent",
};

const PAGE_SIZE = 20;
const POST_SELECT = "id, cover, author_id, type, provenance, audience, like_count, allow_reposts, quoted_post_id, sources, title, body, topics, sensitive, is_quick, has_poll, poll_closes_at, created_at, is_series_opener, series_root_id, series_position, series_cadence, series_status, profiles!posts_author_id_fkey(display_name, avatar, verified_professionals!verified_professionals_user_id_fkey(title))";

const SuggestedMembers = dynamic(() => import("@/components/SuggestedMembers"), { ssr: false });

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
  const { user, loading: authLoading, quietMode } = useAuth();
  const currentUserId = user?.id ?? null;
  const userId = currentUserId;
  const isSignedIn = Boolean(currentUserId);
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);
  const [followingItems, setFollowingItems] = useState<FollowingItem[]>([]);
  const [reposterProfiles, setReposterProfiles] = useState<Record<string, ReposterProfile>>({});
  const [pollResults, setPollResults] = useState<Record<string, PollResult[]>>({});
  const [reasonsByPostId, setReasonsByPostId] = useState<Record<string, RecommendationReason>>({});
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});
  const [repostedIds, setRepostedIds] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [savedPostIds, setSavedPostIds] = useState<Record<string, boolean>>({});
  const [savingPostIds, setSavingPostIds] = useState<Record<string, boolean>>({});
  const [revealedPostIds, setRevealedPostIds] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<FeedTab>("forYou");
  const [restoreReady, setRestoreReady] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const restoreState = useRef<FeedRestoreState | null>(null);
  const loadMoreLock = useRef(false);
  const loadMoreSentinel = useRef<HTMLDivElement>(null);
  const likeRequests = useRef(new Set<string>());
  const bookmarkRequests = useRef(new Set<string>());
  const feedTabs = FEED_TABS;
  const changeTab = useCallback((index: number) => {
    const next = feedTabs[index];
    if (next === "following" && !isSignedIn) {
      router.push("/login");
      return;
    }
    if (!next || next === activeTab) return;
    setActiveTab(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab, feedTabs, isSignedIn, router]);
  const swipeHandlers = useSwipeTabs({
    count: feedTabs.length,
    index: feedTabs.indexOf(activeTab),
    onChange: changeTab,
    enabled: true,
  });

  useEffect(() => {
    if (!("ontouchstart" in window) && navigator.maxTouchPoints === 0) return;
    try {
      if (window.localStorage.getItem("swipeHintSeen")) return;
      window.localStorage.setItem("swipeHintSeen", "1");
    } catch {
      // The hint remains available for this visit when storage is disabled.
    }
    const showTimeout = window.setTimeout(() => setShowSwipeHint(true), 0);
    const timeout = window.setTimeout(() => setShowSwipeHint(false), 4500);
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const restoreKey = window.sessionStorage.getItem("feed:return-key");
        const serialized = restoreKey ? window.sessionStorage.getItem(restoreKey) : null;
        if (serialized) {
          const saved = JSON.parse(serialized) as Omit<FeedRestoreState, "tab"> & { tab: FeedTab | "all" };
          if (Number.isFinite(saved.scrollY) && Number.isInteger(saved.pages) && saved.pages > 0) {
            const restored = { ...saved, tab: saved.tab === "all" ? "latest" : saved.tab };
            restoreState.current = restored;
            setActiveTab(restored.tab);
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

    let incomingPosts: Post[];
    let pageHasMore: boolean;
    let incomingPinnedPosts: Post[] = [];
    let followingRows: FollowingFeedRow[] = [];
    let nextReposterProfiles: Record<string, ReposterProfile> = {};

    if (activeTab !== "following" && nextPage === 0) {
      const { data: pinnedRows, error: pinnedError } = await supabase
        .from("pinned_posts")
        .select("post_id")
        .order("sort_order");
      if (pinnedError) {
        setMessage(friendlyError(pinnedError, t));
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const pinnedIds = (pinnedRows ?? []).map((row) => row.post_id);
      if (pinnedIds.length > 0) {
        const { data: pinnedData, error: pinnedPostsError } = await supabase
          .from("posts")
          .select(POST_SELECT)
          .in("id", pinnedIds);
        if (pinnedPostsError) {
          setMessage(friendlyError(pinnedPostsError, t));
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        const pinnedById = new Map(((pinnedData ?? []) as Post[]).map((post) => [post.id, post]));
        incomingPinnedPosts = pinnedIds.flatMap((id) => {
          const pinnedPost = pinnedById.get(id);
          return pinnedPost ? [pinnedPost] : [];
        });
        incomingPinnedPosts = await attachQuoted(incomingPinnedPosts);
        const { rowsByPostId, error: pinnedPollsError } = await loadPollResults(
          incomingPinnedPosts.filter((post) => post.has_poll).map((post) => post.id)
        );
        if (pinnedPollsError) setMessage(friendlyError(pinnedPollsError, t));
        else setPollResults((current) => ({ ...current, ...rowsByPostId }));
      }
      setPinnedPosts(incomingPinnedPosts);
    }

    if (activeTab === "forYou") {
      const { data, error } = await supabase.rpc("feed_for_you", {
        p_limit: PAGE_SIZE,
        p_offset: from,
      });
      if (error) {
        setMessage(friendlyError(error, t));
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const recommendations = (data ?? []) as { id: string; score: number; reason: RecommendationReason }[];
      const uniqueRecommendations = [...new Map(recommendations.map((row) => [row.id, row])).values()];
      const postIds = uniqueRecommendations.map((row) => row.id);
      pageHasMore = recommendations.length === PAGE_SIZE;

      if (postIds.length > 0) {
        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select(POST_SELECT)
          .in("id", postIds);
        if (postsError) {
          setMessage(friendlyError(postsError, t));
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        const postsById = new Map(((postsData ?? []) as Post[]).map((post) => [post.id, post]));
        incomingPosts = postIds.flatMap((postId) => {
          const post = postsById.get(postId);
          return post ? [post] : [];
        });
      } else {
        incomingPosts = [];
      }

      const nextReasons = Object.fromEntries(
        uniqueRecommendations.map(({ id, reason }) => [id, reason])
      ) as Record<string, RecommendationReason>;
      setReasonsByPostId((current) => reset ? nextReasons : { ...current, ...nextReasons });
    } else if (activeTab === "following") {
      const { data, error } = await supabase.rpc("following_feed", {
        p_limit: PAGE_SIZE,
        p_offset: from,
      });
      if (error) {
        setMessage(friendlyError(error, t));
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      followingRows = (data ?? []) as FollowingFeedRow[];
      pageHasMore = followingRows.length === PAGE_SIZE;
      const postIds = [...new Set(followingRows.map((row) => row.post_id))];
      let postsById = new Map<string, Post>();
      if (postIds.length > 0) {
        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select(POST_SELECT)
          .in("id", postIds);
        if (postsError) {
          setMessage(friendlyError(postsError, t));
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        postsById = new Map(((postsData ?? []) as Post[]).map((post) => [post.id, post]));
        incomingPosts = postIds.flatMap((postId) => {
          const post = postsById.get(postId);
          return post ? [post] : [];
        });
      } else {
        incomingPosts = [];
      }

      const reposterIds = [...new Set(followingRows
        .filter((row) => row.kind === "repost" && row.reposter_id)
        .map((row) => row.reposter_id as string))];
      if (reposterIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name, avatar")
          .in("id", reposterIds);
        if (profilesError) {
          setMessage(friendlyError(profilesError, t));
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        nextReposterProfiles = Object.fromEntries(
          ((profiles ?? []) as ReposterProfile[]).map((profile) => [profile.id, profile])
        );
      }
      if (reset) setReasonsByPostId({});
    } else {
      const postsResult = await supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (postsResult.error) {
        setMessage(friendlyError(postsResult.error, t));
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      incomingPosts = (postsResult.data ?? []) as Post[];
      pageHasMore = incomingPosts.length === PAGE_SIZE;
      if (reset) setReasonsByPostId({});
    }

    incomingPosts = await attachQuoted(incomingPosts);
    if (activeTab === "following") {
      const loadedPostIds = new Set(incomingPosts.map((post) => post.id));
      const nextItems = followingRows.flatMap((row) => loadedPostIds.has(row.post_id)
        ? [{ ...row, key: `${row.kind}:${row.post_id}:${row.reposter_id ?? ""}` }]
        : []);
      setFollowingItems((current) => reset ? nextItems : [...current, ...nextItems]);
      setReposterProfiles((current) => reset ? nextReposterProfiles : { ...current, ...nextReposterProfiles });
    } else if (reset) {
      setFollowingItems([]);
      setReposterProfiles({});
    }
    const { rowsByPostId, error: pollsError } = await loadPollResults(
      incomingPosts.filter((post) => post.has_poll).map((post) => post.id)
    );
    if (pollsError) setMessage(friendlyError(pollsError, t));
    else setPollResults((current) => reset ? rowsByPostId : { ...current, ...rowsByPostId });
    const nextPosts = reset ? incomingPosts : mergeUniquePosts(posts, incomingPosts);
    setPosts(nextPosts);
    setHasMore(pageHasMore);
    setPage(nextPage);

    const statePosts = [...new Map([...incomingPinnedPosts, ...incomingPosts].map((post) => [post.id, post])).values()];
    if (statePosts.length > 0) {
      const postIds = statePosts.map((post) => post.id);
      const [likesResult, commentsResult, bookmarksResult, repostsResult] = await Promise.all([
        currentUserId
          ? supabase.from("likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        currentUserId
          ? supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
        currentUserId
          ? supabase.from("reposts").select("post_id").eq("user_id", currentUserId).in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      setLikeStates((current) => {
        const nextLikes = reset ? {} : { ...current };
        for (const post of statePosts) {
          nextLikes[post.id] = { count: post.like_count, liked: false };
        }
        if (!likesResult.error) {
          for (const like of likesResult.data ?? []) {
            const state = nextLikes[like.post_id] ?? { count: 0, liked: false };
            state.liked = true;
            nextLikes[like.post_id] = state;
          }
        }
        return nextLikes;
      });
      if (likesResult.error) setMessage(friendlyError(likesResult.error, t));
      if (!commentsResult.error) {
        setCommentCounts((current) => {
          const counts = reset ? {} : { ...current };
          for (const post of statePosts) counts[post.id] = 0;
          for (const comment of commentsResult.data ?? []) {
            counts[comment.post_id] = (counts[comment.post_id] ?? 0) + 1;
          }
          return counts;
        });
      }

      if (currentUserId) {
        if (bookmarksResult.error) setMessage(friendlyError(bookmarksResult.error, t));
        else {
          setSavedPostIds((current) => {
            const saved = reset ? {} : { ...current };
            for (const post of statePosts) saved[post.id] = false;
            for (const bookmark of bookmarksResult.data ?? []) saved[bookmark.post_id] = true;
            return saved;
          });
        }
        if (repostsResult.error) setMessage(friendlyError(repostsResult.error, t));
        else {
          setRepostedIds((current) => {
            const shared = reset ? {} : { ...current };
            for (const post of statePosts) shared[post.id] = false;
            for (const repost of repostsResult.data ?? []) shared[repost.post_id] = true;
            return shared;
          });
        }
      } else {
        setSavedPostIds((current) => {
          const saved = reset ? {} : { ...current };
          for (const post of statePosts) saved[post.id] = false;
          return saved;
        });
        setRepostedIds((current) => {
          const shared = reset ? {} : { ...current };
          for (const post of statePosts) shared[post.id] = false;
          return shared;
        });
      }
    } else {
      if (reset) {
        setLikeStates({});
        setCommentCounts({});
        setSavedPostIds({});
        setRepostedIds({});
      }
    }

    setLoading(false);
    setLoadingMore(false);
  }, [activeTab, currentUserId, posts, t]);

  const loadPostsPageRef = useRef(loadPostsPage);
  useEffect(() => {
    loadPostsPageRef.current = loadPostsPage;
  }, [loadPostsPage]);

  useEffect(() => {
    if (!restoreReady || authLoading) return;
    const timeout = window.setTimeout(() => void loadPostsPageRef.current(0, true), 0);
    return () => window.clearTimeout(timeout);
  }, [activeTab, authLoading, currentUserId, restoreReady]);

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

  const postById = new Map(posts.map((post) => [post.id, post]));
  const pinnedPostIds = new Set(pinnedPosts.map((post) => post.id));
  const visibleFeedRows = activeTab === "following"
    ? followingItems.flatMap((item) => {
      const post = postById.get(item.post_id);
      return post ? [{ item, post }] : [];
    })
    : posts.filter((post) => !pinnedPostIds.has(post.id)).map((post) => ({
      item: { kind: "post" as const, post_id: post.id, reposter_id: null, happened_at: post.created_at, key: `post:${post.id}` },
      post,
    }));
  const visiblePosts = visibleFeedRows.map(({ post }) => post);

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

  function renderPostCard(post: Post, index: number, key: string, reposter?: ReposterProfile) {
    return (
      <div key={key} className="space-y-2">
        {reposter && (
          <div className="flex items-center gap-2 px-2 text-sm text-gray-600">
            <Avatar name={reposter.display_name || "Her Space member"} avatar={reposter.avatar} size={24} />
            <Link className="font-medium text-deep-plum hover:underline" href={`/u/${reposter.id}`}>
              {reposter.display_name || "Her Space member"}
            </Link>
            <span>{t("feed.sharedBy")}</span>
          </div>
        )}
        <Card
          as="article"
          className={`post-card space-y-4 ${page === 0 && index < 8 ? "post-entry" : ""}`}
          style={page === 0 && index < 8 ? { animationDelay: `${index * 40}ms` } : undefined}
        >
          {post.cover && <div className="h-[72px] overflow-hidden rounded-xl"><CoverArt cover={post.cover} className="h-full" /></div>}
          <DoubleTapLikeArea
            liked={Boolean(likeStates[post.id]?.liked)}
            onLike={() => { if (!likeStates[post.id]?.liked) void toggleLike(post.id); }}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <PostTypeBadgeLink type={post.type} />
              {post.audience === "adult" && <Badge variant="lilac">{t("audience.badge")}</Badge>}
              <ProvenanceBadge provenance={post.provenance} sources={post.sources} short />
              {(post.is_series_opener || post.series_root_id) && <Badge variant="lilac">{t("series.badge")} · {t("series.part")} {post.series_position ?? 1}</Badge>}
            </div>
            <TimeAgo className="text-sm text-gray-500" date={post.created_at} />
          </DoubleTapLikeArea>
          {activeTab === "forYou" && reasonsByPostId[post.id] && (
            <p className="text-xs text-gray-500">{t(reasonTranslationKeys[reasonsByPostId[post.id]])}</p>
          )}

          <div className="space-y-2">
            {!post.is_quick && <DoubleTapLikeArea
              liked={Boolean(likeStates[post.id]?.liked)}
              onLike={() => { if (!likeStates[post.id]?.liked) void toggleLike(post.id); }}
            >
              <h2 className="text-xl font-semibold text-gray-900">
                <Link href={`/post/${post.id}`} onClick={saveScrollForPost}>{post.title}</Link>
              </h2>
            </DoubleTapLikeArea>}
            <QuotedPostCard quotedPostId={post.quoted_post_id} quoted={post.quoted} />
            {post.sensitive && !revealedPostIds[post.id] ? (
              <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4" role="note">
                <p className="text-sm text-rose-950">{t("read.sensitiveWarning")}</p>
                <Button variant="secondary" type="button" onClick={() => setRevealedPostIds((current) => ({ ...current, [post.id]: true }))}>
                  {t("read.showPost")}
                </Button>
              </div>
            ) : (
              <DoubleTapLikeArea
                liked={Boolean(likeStates[post.id]?.liked)}
                onLike={() => { if (!likeStates[post.id]?.liked) void toggleLike(post.id); }}
              >
                <PostBody body={post.body} href={`/post/${post.id}`} onNavigate={saveScrollForPost} clamp={!post.is_quick} linkBody={!post.is_quick} className={post.is_quick ? "text-lg" : ""} />
              </DoubleTapLikeArea>
            )}
          </div>
          {(!post.sensitive || revealedPostIds[post.id]) && post.has_poll && (
            <PollCard postId={post.id} rows={pollResults[post.id] ?? []} closesAt={post.poll_closes_at} />
          )}

          {(!post.sensitive || revealedPostIds[post.id]) && post.topics?.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label={t("common.topics")}>
              {post.topics.map((topic, topicIndex) => (
                <li className="rounded-full bg-soft-lilac px-2.5 py-1 text-xs text-deep-plum" key={`${topic}-${topicIndex}`}>
                  {topic}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-3 border-t border-rose-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
              <Avatar name={getAuthorName(post.profiles)} avatar={getAuthorProfile(post.profiles)?.avatar ?? null} size={32} />
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
              <LikeButton count={likeStates[post.id]?.count ?? 0} liked={likeStates[post.id]?.liked ?? false} onToggle={() => toggleLike(post.id)} />
              {post.allow_reposts && post.author_id !== currentUserId && (
                <RepostButton
                  postId={post.id}
                  authorId={post.author_id}
                  allowReposts={post.allow_reposts}
                  initiallyShared={Boolean(repostedIds[post.id])}
                />
              )}
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
      </div>
    );
  }

  return (
    <PageShell className="max-w-3xl space-y-8 px-4 py-6 md:px-6 md:py-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-deep-plum">{t("feed.title")}</h1>
          </div>
          {!quietMode && <Link
            className="gradient-aurora shadow-glow inline-flex min-h-11 shrink-0 items-center rounded-full px-5 py-2 font-medium text-white"
            href={navConfig.write.href}
          >
            {t("nav.writePost")}
          </Link>}
        </header>

        <nav className="flex flex-wrap gap-2" aria-label={t("feed.posts")}>
          {(Object.keys(feedTabLabels) as FeedTab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "primary" : "secondary"}
              className="min-h-11 whitespace-normal text-sm"
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => {
                if (tab === "following" && !isSignedIn) router.push("/login");
                else changeTab(feedTabs.indexOf(tab));
              }}
            >
              {t(feedTabLabels[tab])}
            </Button>
          ))}
        </nav>

        <div {...swipeHandlers} className="touch-pan-y space-y-4">
        <div data-swipe-content className="space-y-4">
        {loading && <div className="space-y-4">{[0, 1, 2].map((index) => <PostSkeleton key={index} />)}</div>}
        {message && <Card className="text-red-700"><FriendlyErrorMessage message={message} /></Card>}
        {!quietMode && activeTab === "forYou" && page === 0 && !loading && !message && posts.length > 0 && <SuggestedMembers />}
        {!loading && !message && visiblePosts.length === 0 && (activeTab === "following" || pinnedPosts.length === 0) && (
          <Card className="space-y-3 text-gray-700">
            <DecorativeEmptyArt variant={activeTab === "following" ? "sprout" : "cloud"} />
            <p>{activeTab === "following" ? t("feed.noFollowing") : t("feed.noPosts")}</p>
            {activeTab === "following" && (
              <p className="text-sm text-gray-600">{t("empty.followingHint")}</p>
            )}
            {(activeTab === "following" || !quietMode) && (
              <Button
                type="button"
                onClick={() => activeTab === "following" ? changeTab(feedTabs.indexOf("latest")) : router.push("/new")}
              >
                {activeTab === "following" ? t("empty.browseFeed") : t("empty.writeFirst")}
              </Button>
            )}
          </Card>
        )}
        {!quietMode && !loading && !message && activeTab === "following" && visiblePosts.length === 0 && <SuggestedMembers />}

        {activeTab !== "following" && page === 0 && pinnedPosts.length > 0 && (
          <Card as="section" className="space-y-4">
            <h2 className="break-words text-lg font-semibold text-deep-plum">{t("pinned.label")}</h2>
            {pinnedPosts.map((post, index) => renderPostCard(post, index, `pinned:${post.id}`))}
          </Card>
        )}

        <section className="space-y-4" aria-label="Posts">
          {visibleFeedRows.map(({ item, post }, index) => renderPostCard(
            post,
            index,
            item.key,
            item.kind === "repost" && item.reposter_id ? reposterProfiles[item.reposter_id] : undefined
          ))}
        </section>
        </div>

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
        </div>
        {showSwipeHint && <div role="status" className="fixed bottom-24 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 break-words rounded-full bg-deep-plum px-4 py-2 text-center text-sm whitespace-normal text-white shadow-lg motion-reduce:transition-none">{t("swipe.hint")}</div>}
    </PageShell>
  );
}