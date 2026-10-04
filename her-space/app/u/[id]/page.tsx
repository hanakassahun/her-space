"use client";

import { FormEvent, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";

type Professional = { title: string } | { title: string }[] | null;
type Profile = {
  id: string;
  display_name: string | null;
  bio: string;
};
type PostProfile = {
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
  profiles: PostProfile | PostProfile[] | null;
};

const typeVariants: Record<Post["type"], "rose" | "sky" | "mint"> = {
  experience: "rose",
  question: "sky",
  knowledge: "mint",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bioDraft, setBioDraft] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingBio, setSavingBio] = useState(false);
  const [updatingFollow, setUpdatingFollow] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }
      const currentUserId = authData.user.id;
      setUserId(currentUserId);

      const [profileResult, followersResult, followingResult, followResult, postsResult] =
        await Promise.all([
          supabase.from("profiles").select("id, display_name, bio").eq("id", id).single(),
          supabase
            .from("follows")
            .select("follower_id", { count: "exact", head: true })
            .eq("followee_id", id),
          supabase
            .from("follows")
            .select("followee_id", { count: "exact", head: true })
            .eq("follower_id", id),
          currentUserId === id
            ? Promise.resolve({ data: null, error: null })
            : supabase
                .from("follows")
                .select("followee_id")
                .eq("follower_id", currentUserId)
                .eq("followee_id", id)
                .maybeSingle(),
          supabase
            .from("posts")
            .select(
              "id, author_id, type, provenance, sources, title, body, topics, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))"
            )
            .eq("author_id", id)
            .order("created_at", { ascending: false }),
        ]);

      if (cancelled) return;
      if (profileResult.error) {
        setMessage(profileResult.error.message);
      } else {
        setProfile(profileResult.data as Profile);
        setBioDraft(profileResult.data.bio ?? "");
      }
      if (followersResult.error || followingResult.error || followResult.error) {
        setMessage(
          followersResult.error?.message ??
            followingResult.error?.message ??
            followResult.error?.message ??
            "Unable to load follow details."
        );
      }
      setFollowerCount(followersResult.count ?? 0);
      setFollowingCount(followingResult.count ?? 0);
      setIsFollowing(Boolean(followResult.data));
      if (postsResult.error) {
        setMessage(postsResult.error.message);
      } else {
        setPosts((postsResult.data ?? []) as Post[]);
      }
      setLoading(false);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  async function saveBio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || userId !== id || savingBio) return;
    setSavingBio(true);
    setMessage("");
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bioDraft.trim() })
      .eq("id", userId);
    if (error) {
      setMessage(error.message);
    } else {
      setProfile((current) => (current ? { ...current, bio: bioDraft.trim() } : current));
    }
    setSavingBio(false);
  }

  async function toggleFollow() {
    if (!userId || updatingFollow || userId === id) return;
    setUpdatingFollow(true);
    setMessage("");
    const result = isFollowing
      ? await supabase.from("follows").delete().eq("follower_id", userId).eq("followee_id", id)
      : await supabase.from("follows").insert({ followee_id: id });
    if (result.error) {
      setMessage(result.error.message);
    } else {
      setIsFollowing(!isFollowing);
      setFollowerCount((count) => count + (isFollowing ? -1 : 1));
    }
    setUpdatingFollow(false);
  }

  return (
    <PageShell className="max-w-3xl space-y-8 px-4 py-6 md:px-6 md:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="inline-flex min-h-10 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white" href="/feed">
              Back to feed
            </Link>
            {profile && (
              <>
                <div className="mt-4 flex items-center gap-4">
                  <div className="gradient-aurora shadow-glow flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-semibold text-white" aria-hidden="true">
                    {(profile.display_name || "H").trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-deep-plum">
                      {profile.display_name || "Her Space member"}
                    </h1>
                    <p className="mt-1 max-w-xl whitespace-pre-wrap text-gray-700">
                      {profile.bio || ""}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      {followerCount} followers · {followingCount} following
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
          {userId && userId !== id && profile && (
            <Button
              className="mt-7"
              variant={isFollowing ? "secondary" : "primary"}
              type="button"
              onClick={toggleFollow}
              disabled={updatingFollow}
            >
              {isFollowing ? "Unfollow" : "Follow"}
            </Button>
          )}
        </header>

        {userId === id && profile && (
          <Card as="div" className="space-y-3">
          <form className="space-y-3" onSubmit={saveBio}>
            <label className="block space-y-2 text-sm font-medium text-gray-900">
              Edit bio
              <Textarea
                className="min-h-24"
                value={bioDraft}
                onChange={(event) => setBioDraft(event.target.value)}
                maxLength={160}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-gray-500">{bioDraft.length}/160</span>
              <Button
                type="submit"
                disabled={savingBio}
              >
                {savingBio ? "Saving..." : "Save bio"}
              </Button>
            </div>
          </form>
          </Card>
        )}

        {loading && <p className="text-gray-700">Loading profile...</p>}
        {message && <Card className="text-red-700">{message}</Card>}
        {!loading && !profile && !message && (
          <Card className="text-gray-700">Profile not found.</Card>
        )}

        <section className="space-y-4" aria-label="Posts by this user">
          <h2 className="text-xl font-semibold text-deep-plum">Posts</h2>
          {!loading && posts.length === 0 && profile && (
            <Card className="text-gray-700">No posts yet.</Card>
          )}
          {posts.map((post) => (
            <Card as="article" key={post.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant={typeVariants[post.type]} className="capitalize">
                  {post.type}
                </Badge>
                <time className="text-sm text-gray-500" dateTime={post.created_at}>
                  {formatDate(post.created_at)}
                </time>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900">
                  <Link href={`/post/${post.id}`}>{post.title}</Link>
                </h3>
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
            </Card>
          ))}
        </section>
    </PageShell>
  );
}