"use client";

import { useRef, useState, type ChangeEvent, type CompositionEvent, type KeyboardEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import Card from "@/components/ui/Card";
import Textarea from "@/components/ui/Textarea";
import RichText from "@/components/RichText";
import { stripRich } from "@/lib/richtext";
import type { TranslationKey } from "@/lib/i18n/en";

type Props = {
  value: string;
  onChange: (value: string) => void;
  maxPlain?: number;
  maxRaw?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

const colors = ["rose", "lilac", "sky", "mint", "plum", "gold", "gray"] as const;

export default function RichEditor({
  value,
  onChange,
  maxPlain = 5000,
  maxRaw = 12000,
  placeholder,
  disabled = false,
  id,
}: Props) {
  const { t } = useLanguage();
  const ref = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const [preview, setPreview] = useState(false);
  const [popover, setPopover] = useState<"color" | "size" | "font" | null>(null);
  const plainLength = stripRich(value).length;
  const overLimit = value.length > maxRaw;
  const nearLimit = plainLength >= maxPlain * 0.9;

  function writeText(text: string, selectionStart: number, selectionEnd: number) {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
    const inserted = typeof document.execCommand === "function"
      ? document.execCommand("insertText", false, text)
      : false;
    if (!inserted) {
      textarea.setRangeText(text, selectionStart, selectionEnd, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const start = selectionStart + text.length;
    window.requestAnimationFrame(() => textarea.setSelectionRange(start, start));
  }

  function wrap(open: string, close: string, toggle = false) {
    const textarea = ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const wrappedOutside = toggle && value.slice(0, start).endsWith(open) && value.slice(end).startsWith(close);
    if (wrappedOutside) {
      writeText(selected, start - open.length, end + close.length);
      return;
    }
    if (toggle && selected.startsWith(open) && selected.endsWith(close)) {
      writeText(selected.slice(open.length, selected.length - close.length), start, end);
      return;
    }
    const contents = selected || "";
    const inserted = `${open}${contents}${close}`;
    writeText(inserted, start, end);
    if (!selected) {
      window.requestAnimationFrame(() => textarea.setSelectionRange(start + open.length, start + open.length));
    }
  }

  function formatLines(mode: "h" | "quote" | "center" | "ul" | "ol") {
    const textarea = ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEnd = value.indexOf("\n", end);
    const effectiveEnd = lineEnd < 0 ? value.length : lineEnd;
    const selected = value.slice(lineStart, effectiveEnd);
    const lines = selected.split("\n");
    const wrapped = lines.map((line, index) => {
      if (mode === "ul") return line.startsWith("- ") ? line.slice(2) : `- ${line}`;
      if (mode === "ol") return /^\d+\. /.test(line) ? line.replace(/^\d+\. /, "") : `${index + 1}. ${line}`;
      const tags: Record<"h" | "quote" | "center", [string, string]> = {
        h: ["[h]", "[/h]"], quote: ["[quote]", "[/quote]"], center: ["[center]", "[/center]"],
      };
      const [open, close] = tags[mode];
      return line.startsWith(open) && line.endsWith(close)
        ? line.slice(open.length, line.length - close.length)
        : `${open}${line}${close}`;
    }).join("\n");
    writeText(wrapped, lineStart, effectiveEnd);
  }

  function onInput(event: ChangeEvent<HTMLTextAreaElement>) {
    if (!composing.current) onChange(event.target.value);
  }
  function onCompositionEnd(event: CompositionEvent<HTMLTextAreaElement>) {
    composing.current = false;
    onChange(event.currentTarget.value);
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    const tag = key === "b" ? "b" : key === "i" ? "i" : key === "u" ? "u" : null;
    if (!tag) return;
    event.preventDefault();
    wrap(`[${tag}]`, `[/${tag}]`, true);
  }

  function button(label: TranslationKey, action: () => void, glyph: string) {
    return (
      <button
        key={label}
        type="button"
        aria-label={t(label)}
        title={t(label)}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={action}
        className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-soft-lilac bg-white px-2 font-semibold text-deep-plum hover:bg-soft-lilac/40 disabled:opacity-50"
      >
        {glyph}
      </button>
    );
  }

  const selectedSize = (size: string) => wrap(`[size=${size}]`, "[/size]");
  const selectedFont = (font: string) => wrap(`[font=${font}]`, "[/font]");
  const removeFamily = (family: "color" | "size" | "font") => {
    const textarea = ref.current;
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const pattern = new RegExp(`\\[/?${family}(?:=[a-z]{2,12})?\\]`, "g");
    writeText(value.slice(start, end).replace(pattern, ""), start, end);
  };
  const selectedColor = (color: string) => color === "default" ? removeFamily("color") : wrap(`[color=${color}]`, "[/color]");

  return (
    <div className="space-y-2">
      <div className="hide-scrollbar flex gap-1 overflow-x-auto pb-1" role="toolbar" aria-label={t("rich.preview")}>
        {button("rich.bold", () => wrap("[b]", "[/b]", true), "B")}
        {button("rich.italic", () => wrap("[i]", "[/i]", true), "I")}
        {button("rich.underline", () => wrap("[u]", "[/u]", true), "U")}
        {button("rich.strike", () => wrap("[s]", "[/s]", true), "S")}
        {button("rich.highlight", () => wrap("[mark]", "[/mark]", true), "▰")}
        {button("rich.heading", () => formatLines("h"), "H")}
        {button("rich.quote", () => formatLines("quote"), "❞")}
        {button("rich.bullets", () => formatLines("ul"), "•")}
        {button("rich.numbers", () => formatLines("ol"), "1.")}
        {button("rich.divider", () => {
          const textarea = ref.current;
          if (!textarea) return;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
          const suffix = end < value.length && value[end] !== "\n" ? "\n" : "";
          writeText(`${prefix}---${suffix}`, start, end);
        }, "―")}
        {button("rich.center", () => formatLines("center"), "≡")}
        {(["color", "size", "font"] as const).map((kind) => (
          <button key={kind} type="button" className="inline-flex h-11 shrink-0 items-center rounded-xl border border-soft-lilac bg-white px-3 text-sm text-deep-plum" aria-label={t(`rich.${kind}` as TranslationKey)} aria-expanded={popover === kind} onMouseDown={(event) => event.preventDefault()} onClick={() => setPopover(popover === kind ? null : kind)}>
            {t(`rich.${kind}` as TranslationKey)}
          </button>
        ))}
        {button("rich.clear", () => {
          const textarea = ref.current;
          if (!textarea) return;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          writeText(stripRich(value.slice(start, end)), start, end);
        }, "×")}
      </div>
      {popover && (
        <Card className="flex flex-wrap gap-2 p-3" aria-label={t(`rich.${popover}` as TranslationKey)}>
          {popover === "color" && <>
            <button type="button" className="min-h-11 rounded-full border px-3" onMouseDown={(event) => event.preventDefault()} onClick={() => { selectedColor("default"); setPopover(null); }}>{t("rich.default")}</button>
            {colors.map((color) => <button key={color} type="button" aria-label={t(`rich.${color}` as TranslationKey)} title={t(`rich.${color}` as TranslationKey)} className="h-11 w-11 rounded-full border" style={{ backgroundColor: ({ rose: "#A12B63", lilac: "#6A4DB3", sky: "#1F62A8", mint: "#1D7552", plum: "#2A1B3D", gold: "#8A5200", gray: "#4B5563" } as const)[color] }} onMouseDown={(event) => event.preventDefault()} onClick={() => { selectedColor(color); setPopover(null); }} />)}
          </>}
          {popover === "size" && (["small", "normal", "large", "huge"] as const).map((size) => <button key={size} type="button" className="min-h-11 rounded-full border px-3" onMouseDown={(event) => event.preventDefault()} onClick={() => { if (size === "normal") removeFamily("size"); else selectedSize(size); setPopover(null); }}>{t(`rich.${size}`)}</button>)}
          {popover === "font" && (["sans", "serif", "hand", "mono"] as const).map((font) => <button key={font} type="button" className="min-h-11 rounded-full border px-3" onMouseDown={(event) => event.preventDefault()} onClick={() => { if (font === "sans") removeFamily("font"); else selectedFont(font); setPopover(null); }}>{t(`rich.font${font[0].toUpperCase()}${font.slice(1)}` as TranslationKey)}</button>)}
        </Card>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <Textarea
          ref={ref}
          id={id}
          className="min-h-48 text-base"
          value={value}
          onChange={onInput}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={onCompositionEnd}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={overLimit || plainLength > maxPlain}
        />
        {preview && <Card className="min-h-48 whitespace-pre-wrap p-4"><h3 className="mb-2 text-sm font-semibold text-gray-600">{t("rich.preview")}</h3><RichText text={stripRich(value)} rich={value} /></Card>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className={overLimit || plainLength > maxPlain ? "text-red-700" : nearLimit ? "text-amber-700" : "text-gray-600"}>{plainLength}/{maxPlain} · {value.length}/{maxRaw}</p>
        <button type="button" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-deep-plum underline" aria-pressed={preview} onClick={() => setPreview((current) => !current)}>{t("rich.preview")}</button>
      </div>
      <p className="break-words text-sm text-gray-600">{t("rich.tip")}</p>
    </div>
  );
}
