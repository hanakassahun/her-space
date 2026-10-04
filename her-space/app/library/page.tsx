"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProvenanceBadge from "@/components/ProvenanceBadge";

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

const typeStyles: Record<Post["type"], string> = {
  experience: "bg-rose-100 text-rose-800",
  question: "bg-amber-100 text-amber-800",
  knowledge: "bg-emerald-100 text-emerald-800",
};

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
    <main className="min-h-screen bg-rose-50 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="text-sm text-rose-800 underline" href="/feed">
              Back to feed
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-rose-900">My Library</h1>
          </div>
        </header>

        {topics.length > 0 && (
          <nav className="flex flex-wrap gap-2" aria-label="Filter saved posts by topic">
            <button
              className={`rounded px-3 py-1.5 text-sm ${
                selectedTopic === null
                  ? "bg-rose-700 text-white"
                  : "border border-rose-300 bg-white text-rose-800"
              }`}
              type="button"
              onClick={() => setSelectedTopic(null)}
              aria-pressed={selectedTopic === null}
            >
              All topics
            </button>
            {topics.map((topic) => (
              <button
                className={`rounded px-3 py-1.5 text-sm ${
                  selectedTopic === topic
                    ? "bg-rose-700 text-white"
                    : "border border-rose-300 bg-white text-rose-800"
                }`}
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                aria-pressed={selectedTopic === topic}
              >
                {topic}
              </button>
            ))}
          </nav>
        )}

        {loading && <p className="text-gray-700">Loading your library...</p>}
        {message && <p className="rounded bg-white p-4 text-red-600">{message}</p>}
        {!loading && !message && savedPosts.length === 0 && (
          <p className="rounded bg-white p-6 text-gray-700">
            You haven&apos;t saved any posts yet.
          </p>
        )}
        {!loading && !message && savedPosts.length > 0 && visiblePosts.length === 0 && (
          <p className="rounded bg-white p-6 text-gray-700">
            No saved posts match this topic.
          </p>
        )}

        <section className="space-y-4" aria-label="Saved posts">
          {visiblePosts.map(({ post, savedAt }) => {
            const profile = first(post.profiles);
            const professionalTitle = getProfessionalTitle(profile);

            return (
              <article key={post.id} className="space-y-4 rounded bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`rounded px-2.5 py-1 text-xs font-semibold capitalize ${typeStyles[post.type]}`}
                  >
                    {post.type}
                  </span>
                  <time className="text-sm text-gray-500" dateTime={savedAt}>
                    Saved {formatDate(savedAt)}
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
                    By {profile?.display_name || "Her Space member"}
                    {professionalTitle && (
                      <span className="rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                        Verified professional: {professionalTitle}
                      </span>
                    )}
                  </p>
                  <button
                    className="rounded border border-rose-700 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-50"
                    type="button"
                    onClick={() => unsavePost(post.id)}
                    disabled={busyPostId === post.id}
                  >
                    {busyPostId === post.id ? "Unsaving..." : "Unsave"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}