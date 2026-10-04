"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

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

const topicGroups = {
  Health: [
    "periods",
    "hormones",
    "PCOS",
    "fertility",
    "contraception",
    "sexual health",
    "breast health",
  ],
  "Body & Beauty": ["skin", "hair", "hygiene"],
  "Mind & Life": ["mental health", "relationships", "confidence"],
  "Life stages": ["puberty", "pregnancy", "postpartum", "menopause"],
};

const typeVariants: Record<Post["type"], "rose" | "sky" | "mint"> = {
  experience: "rose",
  question: "sky",
  knowledge: "mint",
};

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function getProfessionalTitle(profile: Profile | null | undefined) {
  return first(profile?.verified_professionals ?? null)?.title;
}

export default function ExplorePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setAuthChecked(true);
    }
    void checkAuth();
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!userId || !authChecked) return;
    let cancelled = false;

    async function searchPosts() {
      setLoading(true);
      setMessage("");
      let query = supabase
        .from("posts")
        .select(
          "id, author_id, type, provenance, sources, title, body, topics, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))"
        )
        .order("created_at", { ascending: false });

      if (debouncedSearch) {
        const safeTerm = debouncedSearch.replace(/[%,()]/g, " ").replace(/\s+/g, " ");
        if (safeTerm.trim()) {
          query = query.or(
            `title.ilike.%${safeTerm.trim()}%,body.ilike.%${safeTerm.trim()}%`
          );
        }
      }
      if (selectedTopic) query = query.contains("topics", [selectedTopic]);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setMessage(error.message);
      } else {
        setPosts((data ?? []) as Post[]);
      }
      setLoading(false);
    }

    void searchPosts();
    return () => {
      cancelled = true;
    };
  }, [authChecked, debouncedSearch, selectedTopic, userId]);

  return (
    <PageShell className="max-w-3xl space-y-8 px-4 py-6 md:px-6 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="inline-flex min-h-10 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/feed">
              Back to feed
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-deep-plum">Explore</h1>
          </div>
          <Link
            className="inline-flex min-h-11 items-center rounded-full border border-white/60 bg-white/65 px-4 py-2 font-medium text-deep-plum"
            href={`/u/${userId ?? ""}`}
          >
            My profile
          </Link>
        </header>

        <Input
          className="min-h-12 rounded-full border-white/70 bg-white/80 shadow-sm"
          type="search"
          placeholder="Search posts by title or body"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search posts"
        />

        <div className="space-y-4">
          {Object.entries(topicGroups).map(([heading, topics]) => (
            <section className="space-y-2" key={heading} aria-label={heading}>
              <h2 className="text-sm font-semibold text-deep-plum">{heading}</h2>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <Button
                    variant={selectedTopic === topic ? "primary" : "secondary"}
                    className={`text-sm ${
                      selectedTopic === topic
                        ? "gradient-aurora shadow-glow text-white"
                        : ""
                    }`}
                    key={topic}
                    type="button"
                    aria-pressed={selectedTopic === topic}
                    onClick={() =>
                      setSelectedTopic((current) => (current === topic ? null : topic))
                    }
                  >
                    {topic}
                  </Button>
                ))}
              </div>
            </section>
          ))}
          {selectedTopic && (
            <Button
              variant="ghost"
              className="text-sm"
              type="button"
              onClick={() => setSelectedTopic(null)}
            >
              Clear topic filter
            </Button>
          )}
        </div>

        {loading && <p className="text-gray-700">Searching posts...</p>}
        {message && <Card className="text-red-700">{message}</Card>}
        {!loading && !message && posts.length === 0 && (
          <Card className="text-gray-700">No posts found.</Card>
        )}

        <section className="space-y-4" aria-label="Explore results">
          {posts.map((post) => {
            const profile = first(post.profiles);
            const professionalTitle = getProfessionalTitle(profile);

            return (
              <Card as="article" key={post.id} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant={typeVariants[post.type]} className="capitalize">
                    {post.type}
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
                    <Link href={`/post/${post.id}`}>{post.title}</Link>
                  </h2>
                  <p className="whitespace-pre-wrap text-gray-800">{post.body}</p>
                </div>
                <ProvenanceBadge provenance={post.provenance} sources={post.sources} />
                {post.topics?.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label="Topics">
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
                <p className="flex flex-wrap items-center gap-2 border-t border-rose-100 pt-3 text-sm text-gray-600">
                  By{" "}
                  <Link className="underline" href={`/u/${post.author_id}`}>
                    {profile?.display_name || "Her Space member"}
                  </Link>
                  {professionalTitle && (
                    <span className="rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                      Verified professional: {professionalTitle}
                    </span>
                  )}
                </p>
              </Card>
            );
          })}
        </section>
    </PageShell>
  );
}