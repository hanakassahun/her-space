import { supabase } from "@/lib/supabase";

export type PollResult = {
  post_id: string;
  option_id: string;
  label: string;
  option_position: number;
  votes: number | null;
  total: number | null;
  my_option: string | null;
  is_open: boolean;
  results_visible: boolean;
};

export function getPollClosingTime(duration: string): string | null {
  const daysByDuration: Record<string, number> = { "1": 1, "3": 3, "7": 7, "30": 30 };
  const days = daysByDuration[duration];
  return days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
}

export async function loadPollResults(postIds: string[]) {
  if (postIds.length === 0) return { rowsByPostId: {}, error: null };
  const { data, error } = await supabase.rpc("poll_results", { p_posts: postIds });
  if (error) return { rowsByPostId: {}, error };

  const rowsByPostId: Record<string, PollResult[]> = {};
  for (const row of (data ?? []) as PollResult[]) {
    (rowsByPostId[row.post_id] ??= []).push(row);
  }
  for (const [postId, rows] of Object.entries(rowsByPostId)) {
    rowsByPostId[postId] = [...rows].sort((left, right) => left.option_position - right.option_position);
  }
  return { rowsByPostId, error: null };
}
