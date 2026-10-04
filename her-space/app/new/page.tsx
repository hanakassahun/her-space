"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

type PostType = "experience" | "question" | "knowledge";
type Provenance = "personal" | "community" | "evidence";

export default function NewPostPage() {
  const router = useRouter();
  const [type, setType] = useState<PostType>("experience");
  const [provenance, setProvenance] = useState<Provenance>("personal");
  const [sources, setSources] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topics, setTopics] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search);
      const sharedTitle = query.get("title");
      const sharedTopics = query.get("topics");
      if (sharedTitle) setTitle(sharedTitle);
      if (sharedTopics) setTopics(sharedTopics);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const sourceList = sources
      .split("\n")
      .map((source) => source.trim())
      .filter(Boolean);
    if (provenance === "evidence" && sourceList.length === 0) {
      setMessage("Add at least one source link for evidence-backed posts.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("posts").insert({
      type,
      provenance,
      sources: provenance === "evidence" ? sourceList : [],
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
    <PageShell className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-deep-plum">Write a post</h1>
        </div>

        <Card as="div" className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm font-medium text-gray-900">
            Type
            <select
              className="min-h-11 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 text-deep-plum focus:outline-none focus:ring-2 focus:ring-soft-lilac"
              value={type}
              onChange={(event) => {
                const nextType = event.target.value as PostType;
                setType(nextType);
                setProvenance(nextType === "experience" ? "personal" : "community");
                setSources("");
              }}
            >
              <option value="experience">Experience</option>
              <option value="question">Question</option>
              <option value="knowledge">Knowledge</option>
            </select>
          </label>

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            What is this post?
            <select
              className="min-h-11 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 text-deep-plum focus:outline-none focus:ring-2 focus:ring-soft-lilac"
              value={provenance}
              onChange={(event) => {
                const nextProvenance = event.target.value as Provenance;
                setProvenance(nextProvenance);
                if (nextProvenance !== "evidence") setSources("");
              }}
            >
              <option value="personal">My personal experience</option>
              <option value="community">Shared knowledge, not medically verified</option>
              <option value="evidence">Backed by sources</option>
            </select>
          </label>

          {provenance === "evidence" && (
            <label className="block space-y-2 text-sm font-medium text-gray-900">
              Source links (one per line)
              <Textarea
                className="min-h-28"
                placeholder="https://example.com/source"
                value={sources}
                onChange={(event) => setSources(event.target.value)}
                required
              />
            </label>
          )}

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            Title
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            Body
            <Textarea
              className="min-h-48"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            Topics
            <Input
              placeholder="e.g. wellbeing, relationships"
              value={topics}
              onChange={(event) => setTopics(event.target.value)}
            />
          </label>

          {message && <p className="text-sm text-red-600">{message}</p>}
          <Button
            className="w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Publishing..." : "Publish post"}
          </Button>
        </form>
        </Card>
    </PageShell>
  );
}