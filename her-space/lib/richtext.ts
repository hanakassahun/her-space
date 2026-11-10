export const STRIP_RE = /\[(\/?(b|i|u|s|mark|center|quote|h)|\/(color|size|font)|(color|size|font)=[a-z]{2,12})\]/g;

const TOKEN_RE = /\[(\/?(?:b|i|u|s|mark|center|quote|h)|\/(?:color|size|font)|(?:color|size|font)=[a-z]{2,12})\]/g;
const LINE_TAGS = new Set(["h", "quote", "center"]);

export type RichNode =
  | { type: "text"; value: string }
  | { type: "tag"; name: string; value?: string; children: RichNode[] };

type Token = { start: number; end: number; raw: string; name: string; closing: boolean; value?: string };

export function stripRich(text: string): string {
  return text.replace(STRIP_RE, "");
}

export function trimRich(text: string): string {
  const tokenMask = new Uint8Array(text.length);
  STRIP_RE.lastIndex = 0;
  for (const match of text.matchAll(STRIP_RE)) {
    const start = match.index ?? 0;
    for (let index = start; index < start + match[0].length; index++) tokenMask[index] = 1;
  }
  const visiblePositions: number[] = [];
  for (let index = 0; index < text.length; index++) {
    if (!tokenMask[index]) visiblePositions.push(index);
  }
  const visible = visiblePositions.map((index) => text[index]).join("");
  const leading = visible.length - visible.trimStart().length;
  const trailing = visible.length - visible.trimEnd().length;
  const removed = new Set<number>([
    ...visiblePositions.slice(0, leading),
    ...visiblePositions.slice(Math.max(leading, visiblePositions.length - trailing)),
  ]);
  return text.split("").filter((_, index) => !removed.has(index)).join("");
}

export function hasRich(text: string): boolean {
  STRIP_RE.lastIndex = 0;
  const tagged = STRIP_RE.test(text);
  STRIP_RE.lastIndex = 0;
  return tagged
    || /^(?:- |[1-9]\d*\. )/m.test(text)
    || /^(?:---)$/m.test(text);
}

function getTokens(text: string): Token[] {
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const raw = match[0];
    const inner = raw.slice(1, -1);
    const closing = inner.startsWith("/");
    const content = closing ? inner.slice(1) : inner;
    const [name, value] = content.split("=");
    tokens.push({ start: match.index ?? 0, end: (match.index ?? 0) + raw.length, raw, name, closing, value });
  }
  return tokens;
}

function lineTagTokens(text: string, tokens: Token[]): Set<Token> {
  const valid = new Set<Token>();
  const lines = text.split("\n");
  const starts: number[] = [];
  let cursor = 0;
  for (const line of lines) {
    starts.push(cursor);
    cursor += line.length + 1;
  }
  const lineAt = (offset: number) => {
    let lo = 0;
    let hi = starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (starts[mid] <= offset) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  };
  const stack: Token[] = [];
  for (const token of tokens) {
    if (!LINE_TAGS.has(token.name)) continue;
    const lineIndex = lineAt(token.start);
    const line = lines[lineIndex] ?? "";
    const lineStart = starts[lineIndex] ?? 0;
    const lineEnd = lineStart + line.length;
    if (!token.closing) {
      if (token.start === lineStart && line.startsWith(token.raw)) stack.push(token);
      continue;
    }
    if (token.end !== lineEnd || !line.endsWith(token.raw)) continue;
    const opening = stack.at(-1);
    if (opening?.name === token.name && lineAt(opening.start) <= lineIndex) {
      stack.pop();
      valid.add(opening);
      valid.add(token);
    }
  }
  return valid;
}

export function parseRich(text: string): RichNode[] {
  const tokens = getTokens(text);
  if (tokens.length > 300) return [{ type: "text", value: text }];
  const validLineTokens = lineTagTokens(text, tokens);
  const valid = new Set<Token>();
  const stack: Token[] = [];
  for (const token of tokens) {
    if (LINE_TAGS.has(token.name)) {
      if (validLineTokens.has(token)) valid.add(token);
      continue;
    }
    if (!token.closing) {
      stack.push(token);
      continue;
    }
    const opening = stack.at(-1);
    if (opening && opening.name === token.name) {
      stack.pop();
      if (stack.length < 6) {
        valid.add(opening);
        valid.add(token);
      }
    }
  }

  const root: RichNode[] = [];
  const nodes: RichNode[][] = [root];
  const names: string[] = [];
  let cursor = 0;
  const appendText = (value: string) => {
    if (!value) return;
    const current = nodes.at(-1)!;
    const last = current.at(-1);
    if (last?.type === "text") last.value += value;
    else current.push({ type: "text", value });
  };

  for (const token of tokens) {
    if (!valid.has(token)) continue;
    if (token.start < cursor) continue;
    appendText(text.slice(cursor, token.start));
    cursor = token.end;
    if (token.closing) {
      const expected = token.name;
      if (names.at(-1) === expected) {
        names.pop();
        nodes.pop();
      } else {
        appendText(token.raw);
      }
    } else {
      const node: RichNode = { type: "tag", name: token.name, value: token.value, children: [] };
      nodes.at(-1)!.push(node);
      nodes.push(node.children);
      names.push(token.name);
    }
  }
  appendText(text.slice(cursor));
  return root;
}
