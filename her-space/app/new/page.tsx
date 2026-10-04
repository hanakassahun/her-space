"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PostType = "experience" | "question" | "knowledge";

export default function NewPostPage() {
  const router = useRouter();
  const [type, setType] = useState<PostType>("experience");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topics, setTopics] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase.from("posts").insert({
      type,
      title: title.trim(),
      body: body.trim(),
      topics: topics
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/feed");
  }

  return (
    <main className="min-h-screen bg-rose-50 px-6 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <a className="text-sm text-rose-800 underline" href="/feed">
            Back to feed
          </a>
          <h1 className="mt-3 text-3xl font-bold text-rose-900">Write a post</h1>
        </div>

        <form className="space-y-4 rounded bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm font-medium text-gray-900">
            Type
            <select
              className="w-full rounded border border-rose-300 bg-white p-3 text-gray-900"
              value={type}
              onChange={(event) => setType(event.target.value as PostType)}
            >
              <option value="experience">Experience</option>
              <option value="question">Question</option>
              <option value="knowledge">Knowledge</option>
            </select>
          </label>

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            Title
            <input
              className="w-full rounded border border-rose-300 bg-white p-3 text-gray-900 placeholder:text-gray-400"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            Body
            <textarea
              className="min-h-48 w-full rounded border border-rose-300 bg-white p-3 text-gray-900 placeholder:text-gray-400"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            Topics
            <input
              className="w-full rounded border border-rose-300 bg-white p-3 text-gray-900 placeholder:text-gray-400"
              placeholder="e.g. wellbeing, relationships"
              value={topics}
              onChange={(event) => setTopics(event.target.value)}
            />
          </label>

          {message && <p className="text-sm text-red-600">{message}</p>}
          <button
            className="w-full rounded bg-rose-700 p-3 font-medium text-white disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? "Publishing..." : "Publish post"}
          </button>
        </form>
      </div>
    </main>
  );
}