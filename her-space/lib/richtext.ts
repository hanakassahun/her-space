export const STRIP_RE = /\[(\/?(b|i|u|s|mark|center|quote|h)|\/(color|size|font)|(color|size|font)=[a-z]{2,12})\]/g;

const TOKEN_RE = /\[(\/?(?:b|i|u|s|mark|center|quote|h)|\/(?:color|size|font)|(?:color|size|font)=[a-z]{2,12})\]/g;
const LINE_TAGS = new Set(["h", "quote", "center"]);

export const RICH_COLORS: Record<string, string> = {
  rose: "#A12B63", lilac: "#6A4DB3", sky: "#1F62A8", mint: "#1D7552",
  plum: "#2A1B3D", gold: "#8A5200", gray: "#4B5563",
};
export const RICH_SIZES: Record<string, string> = { small: "0.875rem", large: "1.25rem", huge: "1.6rem" };
export const RICH_FONTS: Record<string, string> = {
  serif: 'Georgia, "Noto Serif", serif',
  hand: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

export type RichNode =
  | { type: "text"; value: string }
  | { type: "tag"; name: string; value?: string; children: RichNode[] };

type Token = { start: number; end: number; raw: string; name: string; closing: boolean; value?: string };

export function stripRich(text: string): string {
  return text.replace(STRIP_RE, "");
}

export function toPostFields(value: string): { body: string; body_rich: string | null; ok: boolean } {
  const raw = value.replace(/\r/g, "").trim();
  const body = stripRich(raw);
  return { body, body_rich: hasRich(raw) ? raw : null, ok: body.trim().length > 0 };
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

function splitRichLines(nodes: RichNode[]): RichNode[][] {
  const lines: RichNode[][] = [[]];
  for (const node of nodes) {
    if (node.type === "text") {
      const parts = node.value.split("\n");
      parts.forEach((part, index) => {
        if (part) lines.at(-1)!.push({ type: "text", value: part });
        if (index < parts.length - 1) lines.push([]);
      });
      continue;
    }
    const childLines = splitRichLines(node.children);
    childLines.forEach((children, index) => {
      if (children.length || !node.children.length) lines.at(-1)!.push({ ...node, children });
      if (index < childLines.length - 1) lines.push([]);
    });
  }
  return lines;
}

function richText(nodes: RichNode[]): string {
  return nodes.map((node) => node.type === "text" ? node.value : richText(node.children)).join("");
}

function stripLinePrefix(nodes: RichNode[], count: number): RichNode[] {
  if (!nodes.length || nodes[0].type !== "text") return nodes;
  const first = nodes[0];
  if (first.value.length <= count) return nodes.slice(1);
  return [{ ...first, value: first.value.slice(count) }, ...nodes.slice(1)];
}

function appendRichNodes(parent: HTMLElement, nodes: RichNode[], doc: Document) {
  for (const node of nodes) {
    if (node.type === "text") {
      parent.appendChild(doc.createTextNode(node.value));
      continue;
    }
    if (node.name === "color" && !RICH_COLORS[node.value ?? ""]
      || node.name === "size" && !RICH_SIZES[node.value ?? ""]
      || node.name === "font" && !RICH_FONTS[node.value ?? ""]) {
      parent.appendChild(doc.createTextNode(`[${node.name}=${node.value ?? ""}]`));
      appendRichNodes(parent, node.children, doc);
      parent.appendChild(doc.createTextNode(`[/${node.name}]`));
      continue;
    }
    const elementName: Record<string, string> = {
      b: "b", i: "i", u: "u", s: "s", mark: "mark", color: "span", size: "span", font: "span",
    };
    const element = doc.createElement(elementName[node.name] ?? "span");
    if (node.name === "color") {
      element.dataset.c = node.value;
      (element as HTMLElement).style.color = RICH_COLORS[node.value!];
    } else if (node.name === "size") {
      element.dataset.s = node.value;
      (element as HTMLElement).style.fontSize = RICH_SIZES[node.value!];
    } else if (node.name === "font") {
      element.dataset.f = node.value;
      (element as HTMLElement).style.fontFamily = RICH_FONTS[node.value!];
    }
    appendRichNodes(element, node.children, doc);
    parent.appendChild(element);
  }
}

export function tagsToDom(text: string, doc: Document): Node[] {
  if (!text) return [];
  const lines = splitRichLines(parseRich(text));
  const result: Node[] = [];
  let list: HTMLOListElement | HTMLUListElement | null = null;
  let listKind: "ul" | "ol" | null = null;
  const flushList = () => {
    if (list) result.push(list);
    list = null;
    listKind = null;
  };
  for (const line of lines) {
    const textLine = richText(line);
    const marker = textLine.startsWith("- ") ? "ul" : /^([1-9]\d*)\. /.test(textLine) ? "ol" : null;
    if (marker) {
      if (listKind !== marker) flushList();
      if (!list) {
        listKind = marker;
        list = doc.createElement(marker);
      }
      const item = doc.createElement("li");
      const prefixLength = marker === "ul" ? 2 : textLine.indexOf(". ") + 2;
      appendRichNodes(item, stripLinePrefix(line, prefixLength), doc);
      list.appendChild(item);
      continue;
    }
    flushList();
    if (textLine === "---") {
      result.push(doc.createElement("hr"));
      continue;
    }
    const blockTag = line.length === 1 && line[0].type === "tag" ? line[0] : null;
    if (blockTag?.name === "h" || blockTag?.name === "quote" || blockTag?.name === "center") {
      const block = doc.createElement(blockTag.name === "h" ? "h2" : blockTag.name === "quote" ? "blockquote" : "div");
      if (blockTag.name === "center") {
        block.dataset.align = "center";
        block.style.textAlign = "center";
      }
      appendRichNodes(block, blockTag.children, doc);
      result.push(block);
      continue;
    }
    const block = doc.createElement("div");
    if (line.length) appendRichNodes(block, line, doc);
    else block.appendChild(doc.createElement("br"));
    result.push(block);
  }
  flushList();
  return result;
}

function normalizeText(value: string, doc: Document): string {
  const normalized = value.replace(/\u00a0/g, " ").replace(/[\u200b\r]/g, "");
  STRIP_RE.lastIndex = 0;
  return normalized.replace(STRIP_RE, (match) => `［${match.slice(1)}`);
}

function normalizedColor(value: string, doc: Document): string {
  const probe = doc.createElement("span");
  probe.style.color = value;
  return probe.style.color.toLowerCase();
}

function colorName(value: string, doc: Document): string | null {
  const target = normalizedColor(value, doc);
  return Object.entries(RICH_COLORS).find(([, color]) => normalizedColor(color, doc) === target)?.[0] ?? null;
}

function fontName(value: string): string | null {
  const first = value.split(",", 1)[0].trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  if (first === "georgia" || first === "noto serif") return "serif";
  if (["segoe print", "bradley hand", "comic sans ms"].includes(first)) return "hand";
  if (["ui-monospace", "sf mono", "menlo", "consolas", "monospace"].includes(first)) return "mono";
  return null;
}

function sizeName(value: string, element: HTMLElement, doc: Document): string | null {
  const raw = value.trim().toLowerCase();
  if (["small", "x-small", "xx-small", "0.875rem", "14px"].includes(raw)) return "small";
  if (["large", "1.25rem", "20px"].includes(raw)) return "large";
  if (["x-large", "xx-large", "1.6rem", "25.6px", "25.59px"].includes(raw)) return "huge";
  const pixels = Number.parseFloat(doc.defaultView?.getComputedStyle(element).fontSize ?? "");
  if (pixels === 14) return "small";
  if (pixels === 20) return "large";
  if (Math.abs(pixels - 25.6) < 0.1) return "huge";
  return null;
}

function inlineToTags(node: Node, doc: Document): string {
  if (node.nodeType === 3) return normalizeText(node.nodeValue ?? "", doc);
  if (node.nodeType !== 1) return "";
  const element = node as HTMLElement;
  const name = element.tagName.toLowerCase();
  if (["script", "style", "img"].includes(name)) return "";
  if (name === "br") return "\n";
  const children = Array.from(element.childNodes).map((child) => inlineToTags(child, doc)).join("");
  const tags: string[] = [];
  const addTag = (tag: string) => {
    if (!tags.includes(tag)) tags.push(tag);
  };
  if (name === "b" || name === "strong") addTag("b");
  else if (name === "i" || name === "em") addTag("i");
  else if (name === "u") addTag("u");
  else if (["s", "strike", "del"].includes(name)) addTag("s");
  else if (name === "mark") addTag("mark");

  const style = element.style;
  const color = name === "font" ? element.getAttribute("color") : style.color;
  const mappedColor = color ? colorName(color, doc) : null;
  if (mappedColor) addTag(`color=${mappedColor}`);
  if (style.backgroundColor && normalizedColor(style.backgroundColor, doc) === normalizedColor("#FDE68A", doc)) addTag("mark");
  const size = name === "font" ? element.getAttribute("size") : style.fontSize;
  const mappedSize = size === "1" || size === "2" ? "small"
    : size === "5" ? "large" : size === "6" || size === "7" ? "huge"
      : size ? sizeName(size, element, doc) : null;
  if (mappedSize) addTag(`size=${mappedSize}`);
  const family = name === "font" ? element.getAttribute("face") : style.fontFamily;
  const mappedFont = family ? fontName(family) : null;
  if (mappedFont) addTag(`font=${mappedFont}`);
  if (style.fontWeight === "bold" || Number.parseInt(style.fontWeight, 10) >= 600) addTag("b");
  if (style.fontStyle === "italic") addTag("i");
  if (/underline/.test(style.textDecorationLine || style.textDecoration)) addTag("u");
  if (/line-through/.test(style.textDecorationLine || style.textDecoration)) addTag("s");
  return tags.reduce((content, tag) => `[${tag}]${content}[/${tag.split("=")[0]}]`, children);
}

function blockText(node: Node, doc: Document): string {
  if (node.childNodes.length === 1 && node.firstChild?.nodeType === 1 && (node.firstChild as HTMLElement).tagName.toLowerCase() === "br") return "";
  return Array.from(node.childNodes).map((child) => inlineToTags(child, doc)).join("");
}

export function domToTags(root: HTMLElement): string {
  const doc = root.ownerDocument;
  const lines: string[] = [];
  const appendBlock = (node: Node, listIndex?: number, listKind?: "ul" | "ol") => {
    const element = node as HTMLElement;
    const name = element.tagName.toLowerCase();
    if (name === "hr") {
      lines.push("---");
      return;
    }
    if (name === "ul" || name === "ol") {
      const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === "li");
      items.forEach((item, index) => appendBlock(item, index + 1, name));
      return;
    }
    if (name === "li") {
      const content = blockText(element, doc);
      const prefix = listKind === "ol" ? `${listIndex ?? 1}. ` : "- ";
      lines.push(`${prefix}${content}`);
      return;
    }
    if (["div", "p", "h2", "blockquote"].includes(name)) {
      const hasBlocks = Array.from(element.children).some((child) => ["div", "p", "h2", "blockquote", "ul", "ol", "li", "hr"].includes(child.tagName.toLowerCase()));
      if (hasBlocks) {
        Array.from(element.childNodes).forEach((child) => {
          if (child.nodeType === 1 && ["div", "p", "h2", "blockquote", "ul", "ol", "li", "hr"].includes((child as HTMLElement).tagName.toLowerCase())) appendBlock(child);
          else if (child.textContent) lines.push(inlineToTags(child, doc));
        });
        return;
      }
      const content = blockText(element, doc).split("\n");
      const wrapper = name === "h2" ? "h" : name === "blockquote" ? "quote" : element.dataset.align === "center" || element.style.textAlign === "center" ? "center" : null;
      for (const line of content) lines.push(wrapper ? `[${wrapper}]${line}[/${wrapper}]` : line);
      return;
    }
    if (["script", "style", "img"].includes(name)) return;
    const text = inlineToTags(node, doc);
    if (text) lines.push(text);
  };
  Array.from(root.childNodes).forEach((child) => {
    if (child.nodeType === 1 && ["div", "p", "h2", "blockquote", "li", "hr", "ul", "ol"].includes((child as HTMLElement).tagName.toLowerCase())) appendBlock(child);
    else if (child.nodeType === 3) lines.push(normalizeText(child.nodeValue ?? "", doc));
    else if (child.nodeType === 1 && (child as HTMLElement).tagName.toLowerCase() === "br") return;
    else if (child.nodeType === 1) appendBlock(child);
  });
  return lines.join("\n").slice(0, 12000);
}
