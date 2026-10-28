import { supabase } from "@/lib/supabase";

export type QuotedPost = {
  id: string;
  title: string;
  body: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

export async function attachQuoted<T extends { quoted_post_id: string | null }>(
  posts: T[]
): Promise<(T & { quoted: QuotedPost | null })[]> {
  const ids = [...new Set(posts.map((post) => post.quoted_post_id).filter((id): id is string => id !== null))];
  if (ids.length === 0) return posts.map((post) => ({ ...post, quoted: null }));

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, body, profiles!posts_author_id_fkey(display_name)")
    .in("id", ids);

  if (error) {
    console.error("Failed to load quoted posts:", error);
    return posts.map((post) => ({ ...post, quoted: null }));
  }

  const quotedById = new Map<string, QuotedPost>(
    (data ?? []).map((post) => [post.id, post as QuotedPost])
  );
  return posts.map((post) => ({
    ...post,
    quoted: post.quoted_post_id ? quotedById.get(post.quoted_post_id) ?? null : null,
  }));
}
