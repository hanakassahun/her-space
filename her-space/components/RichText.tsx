import Link from "next/link";
import { parseRich, RICH_COLORS, RICH_FONTS, RICH_SIZES, stripRich, type RichNode } from "@/lib/richtext";
import { splitMentions } from "@/lib/mentions";

function renderNodes(nodes: RichNode[], keyPrefix: string, mentions?: string[]): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === "text") {
      if (mentions === undefined) return node.value;
      return splitMentions(node.value, mentions).map((segment, segmentIndex) => segment.type === "mention"
        ? <Link key={`${key}-${segmentIndex}`} href={`/u/${segment.value.slice(1).toLowerCase()}`} className="font-medium text-[#7755A5]">{segment.value}</Link>
        : segment.value);
    }
    const children = renderNodes(node.children, key, mentions);
    const inline = (className = "", style?: React.CSSProperties) => (
      <span key={key} className={className} style={style}>{children}</span>
    );
    switch (node.name) {
      case "b": return <strong key={key}>{children}</strong>;
      case "i": return <em key={key}>{children}</em>;
      case "u": return <span key={key} className="underline">{children}</span>;
      case "s": return <span key={key} className="line-through">{children}</span>;
      case "mark": return <mark key={key} className="bg-[#FDE68A] text-[#2A1B3D]">{children}</mark>;
      case "h": return <h2 key={key} className="text-xl font-semibold">{children}</h2>;
      case "quote": return <blockquote key={key} className="border-l-4 border-soft-lilac pl-4">{children}</blockquote>;
      case "center": return inline("block text-center");
      case "color": {
        const color = RICH_COLORS[node.value ?? ""];
        return color ? inline("", { color }) : inline();
      }
      case "size": return RICH_SIZES[node.value ?? ""] ? inline("", { fontSize: RICH_SIZES[node.value!] }) : inline();
      case "font": return RICH_FONTS[node.value ?? ""] ? inline("", { fontFamily: RICH_FONTS[node.value!] }) : inline();
      default: return inline();
    }
  });
}

function splitNodes(nodes: RichNode[]): RichNode[][] {
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
    const childLines = splitNodes(node.children);
    childLines.forEach((children, index) => {
      if (children.length) lines.at(-1)!.push({ ...node, children });
      if (index < childLines.length - 1) lines.push([]);
    });
  }
  return lines;
}

function stripPrefix(nodes: RichNode[], prefixLength: number): RichNode[] {
  if (!nodes.length || nodes[0].type !== "text") return nodes;
  const first = nodes[0];
  if (first.value.length <= prefixLength) return nodes.slice(1);
  return [{ ...first, value: first.value.slice(prefixLength) }, ...nodes.slice(1)];
}

function renderBlock(text: string, rich: string, className: string, mentions?: string[]) {
  if (!rich || stripRich(rich) !== text) {
    const ethiopic = /[\u1200-\u137F]/.test(text);
    const content = mentions === undefined ? text : splitMentions(text, mentions).map((segment, index) => segment.type === "mention"
      ? <Link key={index} href={`/u/${segment.value.slice(1).toLowerCase()}`} className="font-medium text-[#7755A5]">{segment.value}</Link>
      : segment.value);
    return <p lang={ethiopic ? "am" : "en"} className={`user-text break-words whitespace-pre-wrap ${ethiopic ? "user-text-am" : "user-text-en"} ${className}`}>{content}</p>;
  }
  const lines = splitNodes(parseRich(rich));
  const paragraphs: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: React.ReactNode[] = [];
  const flushList = () => {
    if (!listType) return;
    paragraphs.push(listType === "ul"
      ? <ul key={`list-${paragraphs.length}`} className="list-disc pl-6">{listItems}</ul>
      : <ol key={`list-${paragraphs.length}`} className="list-decimal pl-6">{listItems}</ol>);
    listType = null;
    listItems = [];
  };
  for (const [index, original] of lines.entries()) {
    const first = original[0];
    const leadingText = first?.type === "text" ? first.value : "";
    const marker = leadingText.startsWith("- ") ? "ul" : /^([1-9]\d*)\. /.test(leadingText) ? "ol" : null;
    if (marker) {
      if (listType !== marker) flushList();
      listType = marker;
      const prefixLength = marker === "ul" ? 2 : leadingText.indexOf(". ") + 2;
      listItems.push(<li key={`li-${index}`}>{renderNodes(stripPrefix(original, prefixLength), `line-${index}`, mentions)}</li>);
      continue;
    }
    flushList();
    const rawLine = original.map((node) => node.type === "text" ? node.value : "").join("");
    if (rawLine === "---") paragraphs.push(<hr key={`hr-${index}`} className="border-soft-lilac" />);
    else if (original.length === 1 && original[0].type === "tag" && original[0].name === "h") {
      paragraphs.push(<h2 key={`h-${index}`} className="text-xl font-semibold">{renderNodes(original[0].children, `h-${index}`, mentions)}</h2>);
    } else if (original.length === 1 && original[0].type === "tag" && original[0].name === "quote") {
      paragraphs.push(<blockquote key={`q-${index}`} className="border-l-4 border-soft-lilac pl-4">{renderNodes(original[0].children, `q-${index}`, mentions)}</blockquote>);
    } else if (original.length === 1 && original[0].type === "tag" && original[0].name === "center") {
      paragraphs.push(<p key={`c-${index}`} className="text-center">{renderNodes(original[0].children, `c-${index}`, mentions)}</p>);
    } else if (original.length) paragraphs.push(<p key={`p-${index}`} className="whitespace-pre-wrap">{renderNodes(original, `paragraph-${index}`, mentions)}</p>);
    else paragraphs.push(<p key={`p-${index}`} aria-hidden="true">&nbsp;</p>);
  }
  flushList();
  const ethiopic = /[\u1200-\u137F]/.test(text);
  return <div lang={ethiopic ? "am" : "en"} className={`user-text break-words ${ethiopic ? "user-text-am" : "user-text-en"} ${className}`}>{paragraphs}</div>;
}

export default function RichText({ text, rich, className = "", mentions }: { text: string; rich: string | null | undefined; className?: string; mentions?: string[] }) {
  return renderBlock(text, typeof rich === "string" ? rich : "", className, mentions);
}
