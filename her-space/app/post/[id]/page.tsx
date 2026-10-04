"use client";

import { FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PostType = "experience" | "question" | "knowledge";

type Post = {
  id: string;
  type: PostType;
  title: string;
  body: string;
  topics: string[];
  created_at: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

const typeStyles: Record<PostType, string> = {
  experience: "bg-rose-100 text-rose-800",
  question: "bg-amber-100 text-amber-800",
  knowledge: "bg-emerald-100 text-emerald-800",
};

function getAuthorName(profiles: Post["profiles"] | Comment["profiles"]) {
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  return profile?.display_name || "Her Space member";
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [bookmarking, setBookmarking] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [message, setMessage] = useState("");

  async function loadComments(postId: string) {
    const { data, error } = await supabase
      .from("comments")
      .select("id, body, created_at, profiles(display_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setComments((data ?? []) as Comment[]);
  }

  useEffect(() => {
    async function loadPost() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      setUserId(authData.user.id);

      const [postResult, bookmarkResult] = await Promise.all([
        supabase
          .from("posts")
          .select("id, type, title, body, topics, created_at, profiles(display_name)")
          .eq("id", id)
          .single(),
        supabase
          .from("bookmarks")
          .select("post_id")
          .eq("user_id", authData.user.id)
          .eq("post_id", id)
          .maybeSingle(),
      ]);

      if (postResult.error) {
        setMessage(postResult.error.message);
      } else {
        setPost(postResult.data as Post);
      }

      if (bookmarkResult.error) {
        setMessage(bookmarkResult.error.message);
      } else {
        setSaved(Boolean(bookmarkResult.data));
      }

      if (!postResult.error) {
        await loadComments(id);
      }

      setLoading(false);
    }

    void loadPost();
  }, [id, router]);

  async function toggleBookmark() {
    if (!userId || bookmarking) return;

    setBookmarking(true);
    setMessage("");
    const result = saved
      ? await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", userId)
          .eq("post_id", id)
      : await supabase.from("bookmarks").insert({ post_id: id });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setSaved(!saved);
    }
    setBookmarking(false);
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || submittingComment || !commentBody.trim()) return;

    setSubmittingComment(true);
    setMessage("");
    const { error } = await supabase.from("comments").insert({
      post_id: id,
      body: commentBody.trim(),
    });

    if (error) {
      setMessage(error.message);
    } else {
      setCommentBody("");
      await loadComments(id);
    }
    setSubmittingComment(false);
  }

  return (
    <main className="min-h-screen bg-rose-50 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <a className="text-sm text-rose-800 underline" href="/feed">
          Back to feed
        </a>

        {loading && <p className="text-gray-700">Loading post...</p>}
        {message && <p className="rounded bg-white p-4 text-red-600">{message}</p>}

        {post && (
          <>
            <article className="space-y-5 rounded bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`rounded px-2.5 py-1 text-xs font-semibold capitalize ${typeStyles[post.type]}`}
                >
                  {post.type}
                </span>
                <time className="text-sm text-gray-500" dateTime={post.created_at}>
                  {formatDate(post.created_at)}
                </time>
              </div>

              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>
                <p className="whitespace-pre-wrap text-gray-800">{post.body}</p>
              </div>

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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose-100 pt-4">
                <p className="text-sm text-gray-600">By {getAuthorName(post.profiles)}</p>
                <button
                  className={`rounded px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                    saved
                      ? "border border-rose-700 text-rose-700"
                      : "bg-rose-700 text-white"
                  }`}
                  type="button"
                  onClick={toggleBookmark}
                  disabled={bookmarking}
                >
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
            </article>

            <section className="space-y-4" aria-labelledby="comments-heading">
              <h2 id="comments-heading" className="text-xl font-semibold text-rose-900">
                Comments
              </h2>

              {comments.length === 0 ? (
                <p className="rounded bg-white p-5 text-gray-700">No comments yet.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <article key={comment.id} className="space-y-2 rounded bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {getAuthorName(comment.profiles)}
                        </p>
                        <time className="text-xs text-gray-500" dateTime={comment.created_at}>
                          {formatDate(comment.created_at)}
                        </time>
                      </div>
                      <p className="whitespace-pre-wrap text-gray-800">{comment.body}</p>
                    </article>
                  ))}
                </div>
              )}

              <form className="space-y-3 rounded bg-white p-5 shadow-sm" onSubmit={handleCommentSubmit}>
                <label className="block space-y-2 text-sm font-medium text-gray-900">
                  Add a comment
                  <textarea
                    className="min-h-28 w-full rounded border border-rose-300 bg-white p-3 text-gray-900 placeholder:text-gray-400"
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    maxLength={2000}
                    required
                  />
                </label>
                <button
                  className="rounded bg-rose-700 px-4 py-2 font-medium text-white disabled:opacity-50"
                  type="submit"
                  disabled={submittingComment || !commentBody.trim()}
                >
                  {submittingComment ? "Commenting..." : "Comment"}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}