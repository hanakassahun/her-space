export type NotificationPreferences = {
  notif_comments: boolean;
  notif_follows: boolean;
  notif_shares: boolean;
  notif_milestones: boolean;
  notif_series: boolean;
  notif_mentions: boolean;
};

export type NotificationKind =
  | "comment"
  | "follow"
  | "repost"
  | "quote"
  | "review"
  | "notice"
  | "milestone"
  | "series"
  | "mention";

export function getEnabledNotificationKinds(
  prefs: NotificationPreferences
): NotificationKind[] {
  const kinds: NotificationKind[] = [];
  if (prefs.notif_comments) kinds.push("comment");
  if (prefs.notif_follows) kinds.push("follow");
  if (prefs.notif_shares) kinds.push("repost", "quote");
  if (prefs.notif_milestones) kinds.push("milestone");
  if (prefs.notif_series) kinds.push("series");
  if (prefs.notif_mentions) kinds.push("mention");
  kinds.push("review", "notice");
  return kinds;
}
