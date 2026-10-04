"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  type: "experience" | "question" | "knowledge";
  title: string;
  body: string;
  topics: string[];
  created_at: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

const typeStyles: Record<Post["type"], string> = {
  experience: "bg-rose-100 text-rose-800",
  question: "bg-amber-100 text-amber-800",
  knowledge: "bg-emerald-100 text-emerald-800",
};

function getAuthorName(profiles: Post["profiles"]) {
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  return profile?.display_name || "Her Space member";
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPosts() {
      const { data, error } = await supabase
        .from("posts")
        .select("id, type, title, body, topics, created_at, profiles!posts_author_id_fkey(display_name)")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        setPosts((data ?? []) as Post[]);
      }
      setLoading(false);
    }

    void loadPosts();
  }, []);

  return (
    <main className="min-h-screen bg-rose-50 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-rose-700">Her Space</p>
            <h1 className="text-3xl font-bold text-rose-900">Community feed</h1>
          </div>
          <a
            className="shrink-0 rounded bg-rose-700 px-4 py-2 font-medium text-white"
            href="/new"
          >
            Write a post
          </a>
        </header>

        {loading && <p className="text-gray-700">Loading posts...</p>}
        {message && <p className="rounded bg-white p-4 text-red-600">{message}</p>}
        {!loading && !message && posts.length === 0 && (
          <p className="rounded bg-white p-6 text-gray-700">
            No posts yet. Start the conversation.
          </p>
        )}

        <section className="space-y-4" aria-label="Posts">
          {posts.map((post) => (
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

              <p className="border-t border-rose-100 pt-3 text-sm text-gray-600">
                By {getAuthorName(post.profiles)}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}