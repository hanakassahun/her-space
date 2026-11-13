export const MENTION_RE = /(^|[^A-Za-z0-9_@])@([A-Za-z][A-Za-z0-9_]{2,19})/g;

export type MentionSegment = { type: "text" | "mention"; value: string };

export function splitMentions(text: string, allowedUsernames: string[]): MentionSegment[] {
  const allowed = new Set(allowedUsernames.map((username) => username.toLowerCase()));
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  const matcher = new RegExp(MENTION_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(text)) !== null) {
    const prefix = match[1];
    const username = match[2];
    const mentionStart = match.index + prefix.length;
    if (!allowed.has(username.toLowerCase())) continue;

    if (mentionStart > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, mentionStart) });
    }
    segments.push({ type: "mention", value: text.slice(mentionStart, matcher.lastIndex) });
    lastIndex = matcher.lastIndex;
  }

  if (lastIndex < text.length || segments.length === 0) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

export function hasMention(text: string) {
  const matcher = new RegExp(MENTION_RE.source);
  return matcher.test(text);
}
