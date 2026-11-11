"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { attachQuoted, type QuotedPost } from "@/lib/quoted";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PostSkeleton from "@/components/ui/PostSkeleton";
import BookmarkButton from "@/components/ui/BookmarkButton";
import PostTypeBadgeLink from "@/components/PostTypeBadgeLink";
import UserText from "@/components/UserText";
import { useLanguage } from "@/components/LanguageProvider";
import TimeAgo from "@/components/TimeAgo";
import { useAuth } from "@/components/AuthProvider";
import RepostButton from "@/components/RepostButton";
import QuotedPostCard from "@/components/QuotedPostCard";
import Avatar from "@/components/Avatar";
import PollCard from "@/components/PollCard";
import { loadPollResults, type PollResult } from "@/lib/polls";
import DoubleTapLikeArea from "@/components/DoubleTapLikeArea";
import PostBody from "@/components/PostBody";
import CoverArt from "@/components/CoverArt";
import DecorativeEmptyArt from "@/components/DecorativeEmptyArt";

type LikeState = { count: number; liked: boolean };
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

type SavedPost = {
  savedAt: string;
  post: Post;
};

type BookmarkRow = {
  created_at: string;
  posts: Post | Post[] | null;
};

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function getProfessionalTitle(profile: Profile | null | undefined) {
  return first(profile?.verified_professionals ?? null)?.title;
}

export default function LibraryPage() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, PollResult[]>>({});
  const [repostedIds, setRepostedIds] = useState<Record<string, boolean>>({});
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyPostIds, setBusyPostIds] = useState<Record<string, boolean>>({});
  const [revealedPostIds, setRevealedPostIds] = useState<Record<string, boolean>>({});
  const bookmarkRequests = useRef(new Set<string>());
  const likeRequests = useRef(new Set<string>());

  useEffect(() => {
    async function loadLibrary() {
      if (authLoading) return;
      if (!userId) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("bookmarks")
        .select(
          "created_at, posts!bookmarks_post_id_fkey(id, cover, author_id, type, provenance, audience, like_count, allow_reposts, quoted_post_id, sources, title, body, topics, sensitive, is_quick, has_poll, poll_closes_at, created_at, is_series_opener, series_root_id, series_position, series_cadence, series_status, profiles!posts_author_id_fkey(display_name, avatar, verified_professionals!verified_professionals_user_id_fkey(title)))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(friendlyError(error, t));
      } else {
        const rows = (data ?? []) as BookmarkRow[];
        const loadedPosts = rows.flatMap((row) => {
          const post = first(row.posts);
          return post ? [{ savedAt: row.created_at, post }] : [];
        });
        const postsWithQuotes = await attachQuoted(loadedPosts.map(({ post }) => post));
        const { rowsByPostId, error: pollsError } = await loadPollResults(
          loadedPosts.filter(({ post }) => post.has_poll).map(({ post }) => post.id)
        );
        if (pollsError) setMessage(friendlyError(pollsError, t));
        else setPollResults(rowsByPostId);
        const attachedPostsById = new Map(postsWithQuotes.map((post) => [post.id, post]));
        setSavedPosts(loadedPosts.map(({ savedAt, post }) => ({
          savedAt,
          post: attachedPostsById.get(post.id) ?? post,
        })));
        const postIds = loadedPosts.map(({ post }) => post.id);
        if (postIds.length > 0) {
          const [repostsResult, likesResult] = await Promise.all([
            supabase.from("reposts").select("post_id").eq("user_id", userId).in("post_id", postIds),
            supabase.from("likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
          ]);
          if (repostsResult.error) setMessage(friendlyError(repostsResult.error, t));
          else setRepostedIds(Object.fromEntries((repostsResult.data ?? []).map(({ post_id }) => [post_id, true])));
          if (likesResult.error) setMessage(friendlyError(likesResult.error, t));
          else {
            const likedIds = new Set((likesResult.data ?? []).map(({ post_id }) => post_id));
            setLikeStates(Object.fromEntries(loadedPosts.map(({ post }) => [
              post.id,
              { count: post.like_count, liked: likedIds.has(post.id) },
            ])));
          }
        } else {
          setRepostedIds({});
          setLikeStates({});
        }
      }
      setLoading(false);
    }

    void loadLibrary();
  }, [authLoading, router, t, userId]);

  const topics = [...new Set(savedPosts.flatMap(({ post }) => post.topics ?? []))].sort(
    (left, right) => left.localeCompare(right)
  );
  const visiblePosts = selectedTopic
    ? savedPosts.filter(({ post }) => post.topics?.includes(selectedTopic))
    : savedPosts;

  async function toggleLike(postId: string) {
    if (!userId) {
      router.push("/login");
      return;
    }
    if (likeRequests.current.has(postId)) return;
    likeRequests.current.add(postId);
    const current = likeStates[postId] ?? {
      count: savedPosts.find(({ post }) => post.id === postId)?.post.like_count ?? 0,
      liked: false,
    };
    const optimistic = { count: current.count + (current.liked ? -1 : 1), liked: !current.liked };
    setLikeStates((states) => ({ ...states, [postId]: optimistic }));
    try {
      const result = current.liked
        ? await supabase.from("likes").delete().eq("user_id", userId).eq("post_id", postId)
        : await supabase.from("likes").insert({ post_id: postId });
      if (result.error) throw result.error;
    } catch (error) {
      setLikeStates((states) => ({ ...states, [postId]: current }));
      setMessage(friendlyError(error, t));
    } finally {
      likeRequests.current.delete(postId);
    }
  }

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
          <Link className="inline-flex min-h-11 items-center rounded-full border border-soft-lilac bg-white px-4 font-medium text-deep-plum" href="/series">{t("series.discover")}</Link>
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
        {message && <Card className="text-red-700"><FriendlyErrorMessage message={message} /></Card>}
        {!loading && !message && savedPosts.length === 0 && (
          <Card className="space-y-3 text-gray-700">
            <DecorativeEmptyArt variant="sprout" />
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
                {post.cover && <div className="h-[72px] overflow-hidden rounded-xl"><CoverArt cover={post.cover} className="h-full" /></div>}
                <DoubleTapLikeArea
                  liked={Boolean(likeStates[post.id]?.liked)}
                  onLike={() => { if (!likeStates[post.id]?.liked) void toggleLike(post.id); }}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <PostTypeBadgeLink type={post.type} />
                  {post.audience === "adult" && <Badge variant="lilac">{t("audience.badge")}</Badge>}
                  {(post.is_series_opener || post.series_root_id) && <Badge variant="lilac">{t("series.badge")} · {t("series.part")} {post.series_position ?? 1}</Badge>}
                  <span className="text-xs text-gray-500">{likeStates[post.id]?.count ?? post.like_count} {t("like.likes")}</span>
                  <TimeAgo className="text-sm text-gray-500" date={savedAt} prefix={t("library.saved")} />
                </DoubleTapLikeArea>

                <div className="space-y-2">
                  {!post.is_quick && <DoubleTapLikeArea
                    liked={Boolean(likeStates[post.id]?.liked)}
                    onLike={() => { if (!likeStates[post.id]?.liked) void toggleLike(post.id); }}
                  >
                    <h2 className="text-xl font-semibold text-gray-900">
                      <Link href={`/post/${post.id}`}>{post.title}</Link>
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
                    post.is_quick ? (
                      <DoubleTapLikeArea
                        liked={Boolean(likeStates[post.id]?.liked)}
                        onLike={() => { if (!likeStates[post.id]?.liked) void toggleLike(post.id); }}
                      >
                        <PostBody body={post.body} href={`/post/${post.id}`} clamp={false} linkBody={false} className="text-lg" />
                      </DoubleTapLikeArea>
                    ) : <UserText text={post.body} className="text-gray-800" />
                  )}
                </div>
                {(!post.sensitive || revealedPostIds[post.id]) && post.has_poll && (
                  <PollCard postId={post.id} rows={pollResults[post.id] ?? []} closesAt={post.poll_closes_at} />
                )}

                <ProvenanceBadge provenance={post.provenance} sources={post.sources} short />

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
                    <Avatar name={profile?.display_name || "Her Space member"} avatar={profile?.avatar ?? null} size={32} />
                    {t("common.by")} {profile?.display_name || "Her Space member"}
                    {professionalTitle && (
                      <span className="rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                        {t("common.verifiedProfessional")} {professionalTitle}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-1">
                    {post.allow_reposts && post.author_id !== userId && (
                      <RepostButton
                        postId={post.id}
                        authorId={post.author_id}
                        allowReposts={post.allow_reposts}
                        initiallyShared={Boolean(repostedIds[post.id])}
                      />
                    )}
                    <BookmarkButton
                      saved
                      disabled={busyPostIds[post.id] === true}
                      saveLabel={t("post.savePost")}
                      savedLabel={t("library.unsave")}
                      onToggle={() => void unsavePost(post.id)}
                      variant="primary"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
    </PageShell>
  );
}