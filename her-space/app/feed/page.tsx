"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import LikeButton from "@/components/LikeButton";

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

const typeStyles: Record<Post["type"], string> = {
  experience: "bg-rose-100 text-rose-800",
  question: "bg-amber-100 text-amber-800",
  knowledge: "bg-emerald-100 text-emerald-800",
};

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
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});
  const [activeTab, setActiveTab] = useState<"all" | "following">("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPosts() {
      const [authResult, postsResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("posts")
          .select("id, author_id, type, provenance, sources, title, body, topics, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))")
          .order("created_at", { ascending: false }),
      ]);
      const currentUserId = authResult.data.user?.id ?? null;
      setUserId(currentUserId);
      setIsSignedIn(Boolean(currentUserId));

      if (postsResult.error) {
        setMessage(postsResult.error.message);
      } else {
        const loadedPosts = (postsResult.data ?? []) as Post[];
        setPosts(loadedPosts);

        if (currentUserId && loadedPosts.length > 0) {
          const postIds = loadedPosts.map((post) => post.id);
          const [likesResult, followsResult] = await Promise.all([
            supabase.from("likes").select("post_id, user_id").in("post_id", postIds),
            supabase.from("follows").select("followee_id").eq("follower_id", currentUserId),
          ]);

          if (likesResult.error) setMessage(likesResult.error.message);
          else {
            const nextLikes: Record<string, LikeState> = {};
            for (const post of loadedPosts) nextLikes[post.id] = { count: 0, liked: false };
            for (const like of likesResult.data ?? []) {
              const state = nextLikes[like.post_id] ?? { count: 0, liked: false };
              state.count += 1;
              if (like.user_id === currentUserId) state.liked = true;
              nextLikes[like.post_id] = state;
            }
            setLikeStates(nextLikes);
          }
          if (followsResult.error) setMessage(followsResult.error.message);
          else setFollowingIds((followsResult.data ?? []).map((follow) => follow.followee_id));
        } else {
          setLikeStates({});
          setFollowingIds([]);
        }
      }
      setLoading(false);
    }

    void loadPosts();
  }, []);

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
      setMessage(result.error.message);
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

  return (
    <main className="min-h-screen bg-rose-50 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-rose-700">Her Space</p>
            <h1 className="text-3xl font-bold text-rose-900">Community feed</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {isSignedIn && (
              <>
                <Link className="shrink-0 rounded border border-rose-700 px-4 py-2 font-medium text-rose-700" href="/explore">
                  Explore
                </Link>
                <Link className="shrink-0 rounded border border-rose-700 px-4 py-2 font-medium text-rose-700" href={`/u/${userId}`}>
                  My profile
                </Link>
                <Link
                  className="shrink-0 rounded border border-rose-700 px-4 py-2 font-medium text-rose-700"
                  href="/library"
                >
                  My Library
                </Link>
              </>
            )}
            <a
              className="shrink-0 rounded bg-rose-700 px-4 py-2 font-medium text-white"
              href="/new"
            >
              Write a post
            </a>
          </div>
        </header>

        <nav className="flex gap-2" aria-label="Feed posts">
          <button
            className={`rounded px-4 py-2 text-sm font-medium ${activeTab === "all" ? "bg-rose-700 text-white" : "border border-rose-300 bg-white text-rose-800"}`}
            type="button"
            aria-pressed={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          >
            All
          </button>
          <button
            className={`rounded px-4 py-2 text-sm font-medium ${activeTab === "following" ? "bg-rose-700 text-white" : "border border-rose-300 bg-white text-rose-800"}`}
            type="button"
            aria-pressed={activeTab === "following"}
            onClick={() => {
              if (!isSignedIn) router.push("/login");
              else setActiveTab("following");
            }}
          >
            Following
          </button>
        </nav>

        {loading && <p className="text-gray-700">Loading posts...</p>}
        {message && <p className="rounded bg-white p-4 text-red-600">{message}</p>}
        {!loading && !message && visiblePosts.length === 0 && (
          <p className="rounded bg-white p-6 text-gray-700">
            {activeTab === "following" ? "No posts from people you follow yet." : "No posts yet. Start the conversation."}
          </p>
        )}

        <section className="space-y-4" aria-label="Posts">
          {visiblePosts.map((post) => (
            <article key={post.id} className="space-y-4 rounded bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`rounded px-2.5 py-1 text-xs font-semibold capitalize ${typeStyles[post.type]}`}
                >
                  {post.type}
                </span>
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
                <ul className="flex flex-wrap gap-2" aria-label="Topics">
                  {post.topics.map((topic, index) => (
                    <li
                      className="rounded bg-rose-50 px-2.5 py-1 text-xs text-rose-800"
                      key={`${topic}-${index}`}
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose-100 pt-3">
                <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  By <Link className="underline" href={`/u/${post.author_id}`}>{getAuthorName(post.profiles)}</Link>
                  {getProfessionalTitle(getAuthorProfile(post.profiles)) && (
                    <span className="rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                      Verified professional: {getProfessionalTitle(getAuthorProfile(post.profiles))}
                    </span>
                  )}
                </p>
                <LikeButton
                  count={likeStates[post.id]?.count ?? 0}
                  liked={likeStates[post.id]?.liked ?? false}
                  onToggle={() => toggleLike(post.id)}
                />
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}