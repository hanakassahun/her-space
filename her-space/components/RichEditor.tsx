"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import MentionTextarea from "@/components/MentionTextarea";
import MentionPicker, { type MentionMember } from "@/components/MentionPicker";
import { domToTags, hasRich, RICH_COLORS, stripRich, tagsToDom } from "@/lib/richtext";
import { hasMention } from "@/lib/mentions";
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

type Popover = "color" | "size" | "font" | null;

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
  const editorRef = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const lastEmitted = useRef<string | null>(null);
  const [mode, setMode] = useState<"rich" | "plain">("rich");
  const [popover, setPopover] = useState<Popover>(null);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<MentionMember[]>([]);
  const mentionRange = useRef<Range | null>(null);
  const plainLength = stripRich(value).length;
  const rawLength = value.length;
  const plainOverLimit = plainLength > maxPlain;
  const rawOverLimit = rawLength > maxRaw;
  const nearLimit = plainLength >= maxPlain * 0.9;

  useEffect(() => {
    try {
      if (window.localStorage.getItem("editorMode") === "plain") setMode("plain");
    } catch {
      // Keep the formatted editor available when storage is disabled.
    }
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || mode !== "rich" || composing.current || value === lastEmitted.current) return;
    editor.replaceChildren(...tagsToDom(value, document));
    lastEmitted.current = value;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [mode, value]);

  useEffect(() => {
    const updateActiveFormats = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const selection = document.getSelection();
      const anchor = selection?.anchorNode;
      const anchorElement = anchor?.nodeType === 1 ? anchor as HTMLElement : anchor?.parentElement;
      const selectedElement = anchorElement?.closest("[contenteditable='true']") === editor ? anchorElement : null;
      const contains = (selector: string) => Boolean(selectedElement?.closest(selector));
      const command = (name: string) => {
        try {
          return document.queryCommandState(name);
        } catch {
          return false;
        }
      };
      setActiveFormats({
        bold: command("bold") || contains("b, strong"),
        italic: command("italic") || contains("i, em"),
        underline: command("underline") || contains("u"),
        strike: command("strikeThrough") || contains("s, strike, del"),
        highlight: command("hiliteColor") || contains("mark, [style*='background-color']"),
        heading: contains("h2"),
        quote: contains("blockquote"),
        bullets: contains("ul, li") && !contains("ol"),
        numbers: contains("ol"),
        center: contains("[data-align='center'], [style*='text-align: center']"),
      });
    };
    document.addEventListener("selectionchange", updateActiveFormats);
    return () => document.removeEventListener("selectionchange", updateActiveFormats);
  }, []);

  function emitEditorValue() {
    const editor = editorRef.current;
    if (!editor || composing.current) return;
    const next = domToTags(editor);
    if (!next) editor.replaceChildren();
    lastEmitted.current = next;
    onChange(next);
  }

  function placeCaretAtEnd(element: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function runCommand(command: string, argument?: string) {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    editor.focus();
    document.execCommand(command, false, argument);
    emitEditorValue();
  }

  function currentBlock(selector: string): HTMLElement | null {
    const editor = editorRef.current;
    const selection = document.getSelection();
    const anchor = selection?.anchorNode;
    const element = anchor?.nodeType === 1 ? anchor as HTMLElement : anchor?.parentElement;
    const block = element?.closest(selector) as HTMLElement | null;
    return block && editor?.contains(block) ? block : null;
  }

  function toggleBlock(tag: "h2" | "blockquote") {
    runCommand("formatBlock", currentBlock(tag) ? "div" : tag);
  }

  function insertDivider() {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    editor.focus();
    document.execCommand("insertHorizontalRule", false);
    const rules = editor.querySelectorAll("hr");
    const rule = rules.item(rules.length - 1);
    if (rule) {
      const next = document.createElement("div");
      next.appendChild(document.createElement("br"));
      rule.parentNode?.insertBefore(next, rule.nextSibling);
      placeCaretAtEnd(next);
    }
    emitEditorValue();
  }

  function clearFormatting() {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    editor.focus();
    document.execCommand("removeFormat", false);
    Array.from(editor.querySelectorAll("ul, ol")).forEach((list) => {
      const fragment = document.createDocumentFragment();
      Array.from(list.children).filter((child) => child.tagName.toLowerCase() === "li").forEach((item) => {
        const block = document.createElement("div");
        while (item.firstChild) block.appendChild(item.firstChild);
        fragment.appendChild(block);
      });
      list.replaceWith(fragment);
    });
    Array.from(editor.querySelectorAll("h2, blockquote, div[data-align='center']")).forEach((block) => {
      const plain = document.createElement("div");
      while (block.firstChild) plain.appendChild(block.firstChild);
      block.replaceWith(plain);
    });
    emitEditorValue();
  }

  function insertPlainText(text: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const inserted = document.execCommand("insertText", false, text);
    if (!inserted) {
      const selection = document.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    emitEditorValue();
  }

  function toggleMentionPicker() {
    if (disabled || composing.current) return;
    if (mentionPickerOpen) {
      setMentionPickerOpen(false);
      return;
    }
    const selection = document.getSelection();
    const editor = editorRef.current;
    if (selection?.rangeCount && editor?.contains(selection.anchorNode)) {
      mentionRange.current = selection.getRangeAt(0).cloneRange();
    } else if (editor) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      mentionRange.current = range;
    } else {
      mentionRange.current = null;
    }
    setMentionQuery("");
    setMentionResults([]);
    setMentionPickerOpen(true);
    setPopover(null);
  }

  function insertMention(member: MentionMember) {
    if (composing.current || disabled) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = document.getSelection();
    if (mentionRange.current && selection) {
      selection.removeAllRanges();
      selection.addRange(mentionRange.current);
    }
    insertPlainText(`@${member.username} `);
    mentionRange.current = null;
    setMentionPickerOpen(false);
    setMentionResults([]);
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    insertPlainText(event.clipboardData.getData("text/plain"));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    insertPlainText(event.dataTransfer.getData("text/plain"));
  }

  function changeMode(nextMode: "rich" | "plain") {
    setMode(nextMode);
    lastEmitted.current = null;
    try {
      window.localStorage.setItem("editorMode", nextMode);
    } catch {
      // Mode changes still work for this session when storage is disabled.
    }
  }

  function switchToPlain() {
    if (hasRich(value) && !window.confirm(t("rich.simpleWarn"))) return;
    onChange(stripRich(value));
    changeMode("plain");
  }

  function toolbarButton(label: TranslationKey, glyph: string, action: () => void, active?: boolean) {
    return (
      <button
        key={label}
        type="button"
        aria-label={t(label)}
        aria-pressed={active}
        title={t(label)}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => event.preventDefault()}
        onClick={action}
        className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-soft-lilac px-2 font-semibold text-deep-plum hover:bg-soft-lilac/40 disabled:opacity-50 ${active ? "bg-soft-lilac/60" : "bg-white"}`}
      >
        {glyph}
      </button>
    );
  }

  function popoverButton(label: TranslationKey, action: () => void, style?: React.CSSProperties) {
    return (
      <button
        key={label}
        type="button"
        aria-label={t(label)}
        title={t(label)}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => event.preventDefault()}
        onClick={action}
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-soft-lilac bg-white px-3 text-sm text-deep-plum hover:bg-soft-lilac/40 disabled:opacity-50"
        style={style}
      >
        {t(label)}
      </button>
    );
  }

  function chooseColor(color: string) {
    runCommand("foreColor", color === "default" ? "#1F1A2B" : RICH_COLORS[color]);
    setPopover(null);
  }

  const counterClass = rawOverLimit || plainOverLimit
    ? "text-red-700"
    : nearLimit ? "text-amber-700" : "text-gray-600";

  return (
    <div className="space-y-2">
      {mode === "rich" ? (
        <>
          <div className="relative">
          <div className="hide-scrollbar flex gap-1 overflow-x-auto pb-1" role="toolbar" aria-label={t("rich.preview")}>
            {toolbarButton("rich.bold", "B", () => runCommand("bold"), activeFormats.bold)}
            {toolbarButton("rich.italic", "I", () => runCommand("italic"), activeFormats.italic)}
            {toolbarButton("rich.underline", "U", () => runCommand("underline"), activeFormats.underline)}
            {toolbarButton("rich.strike", "S", () => runCommand("strikeThrough"), activeFormats.strike)}
            {toolbarButton("rich.highlight", "▰", () => runCommand("hiliteColor", activeFormats.highlight ? "transparent" : "#FDE68A"), activeFormats.highlight)}
            {toolbarButton("rich.heading", "H", () => toggleBlock("h2"), activeFormats.heading)}
            {toolbarButton("rich.quote", "❞", () => toggleBlock("blockquote"), activeFormats.quote)}
            {toolbarButton("rich.bullets", "•", () => runCommand("insertUnorderedList"), activeFormats.bullets)}
            {toolbarButton("rich.numbers", "1.", () => runCommand("insertOrderedList"), activeFormats.numbers)}
            {toolbarButton("rich.divider", "―", insertDivider)}
            {toolbarButton("rich.center", "≡", () => runCommand(activeFormats.center ? "justifyLeft" : "justifyCenter"), activeFormats.center)}
            <button
              type="button"
              aria-label={t("mention.button")}
              aria-expanded={mentionPickerOpen}
              title={t("mention.button")}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onPointerDown={(event) => event.preventDefault()}
              onClick={toggleMentionPicker}
              className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-soft-lilac px-2 font-semibold text-deep-plum hover:bg-soft-lilac/40 disabled:opacity-50 ${mentionPickerOpen ? "bg-soft-lilac/60" : "bg-white"}`}
            >
              @
            </button>
            {(["color", "size", "font"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-label={t(`rich.${kind}` as TranslationKey)}
                aria-expanded={popover === kind}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => setPopover(popover === kind ? null : kind)}
                className="inline-flex h-11 shrink-0 items-center rounded-xl border border-soft-lilac bg-white px-3 text-sm text-deep-plum hover:bg-soft-lilac/40 disabled:opacity-50"
              >
                {t(`rich.${kind}` as TranslationKey)}
              </button>
            ))}
            {toolbarButton("rich.clear", "×", clearFormatting)}
          </div>
          {mentionPickerOpen && (
            <div className="absolute left-0 top-full z-30 mt-2 w-full max-w-sm space-y-2 rounded-2xl border border-soft-lilac bg-white p-3 shadow-xl">
              <input
                autoFocus
                aria-label={t("mention.button")}
                placeholder={t("mention.hint")}
                className="min-h-11 w-full rounded-xl border border-[#CDBDEB] bg-white px-3 text-deep-plum focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8]"
                value={mentionQuery}
                onChange={(event) => {
                  setMentionQuery(event.target.value);
                  setMentionResults([]);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setMentionPickerOpen(false);
                  else if (event.key === "Enter" && mentionResults[0]) {
                    event.preventDefault();
                    insertMention(mentionResults[0]);
                  }
                }}
              />
              <MentionPicker query={mentionQuery} onSelect={insertMention} onResultsChange={setMentionResults} />
              <button type="button" className="min-h-11 break-words text-sm font-medium text-deep-plum underline" onClick={() => setMentionPickerOpen(false)}>
                {t("common.cancel")}
              </button>
            </div>
          )}
          </div>
          {popover && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-soft-lilac bg-white p-3" role="group" aria-label={t(`rich.${popover}` as TranslationKey)}>
              {popover === "color" && <>
                {popoverButton("rich.default", () => chooseColor("default"))}
                {Object.entries(RICH_COLORS).map(([color, hex]) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={t(`rich.${color}` as TranslationKey)}
                    title={t(`rich.${color}` as TranslationKey)}
                    disabled={disabled}
                    className="h-11 w-11 shrink-0 rounded-full border border-gray-300"
                    style={{ backgroundColor: hex }}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => chooseColor(color)}
                  />
                ))}
              </>}
              {popover === "size" && (["small", "normal", "large", "huge"] as const).map((size) => popoverButton(`rich.${size}` as TranslationKey, () => {
                runCommand("fontSize", size === "small" ? "2" : size === "normal" ? "3" : size === "large" ? "5" : "6");
                setPopover(null);
              }))}
              {popover === "font" && (["sans", "serif", "hand", "mono"] as const).map((font) => popoverButton(`rich.font${font[0].toUpperCase()}${font.slice(1)}` as TranslationKey, () => {
                const editor = editorRef.current;
                const family = font === "sans" ? editor ? getComputedStyle(editor).fontFamily : "sans-serif"
                  : font === "serif" ? "Georgia" : font === "hand" ? "Segoe Print" : "ui-monospace";
                runCommand("fontName", family);
                setPopover(null);
              }))}
            </div>
          )}
          <div
            ref={editorRef}
            id={id}
            contentEditable={disabled ? "false" : "true"}
            role="textbox"
            aria-multiline="true"
            aria-label={placeholder ?? t("common.body")}
            aria-disabled={disabled}
            aria-invalid={rawOverLimit || plainOverLimit}
            data-placeholder={placeholder ?? t("common.body")}
            spellCheck
            autoCapitalize="sentences"
            suppressContentEditableWarning
            onFocus={() => {
              document.execCommand("defaultParagraphSeparator", false, "div");
              document.execCommand("styleWithCSS", false, "true");
            }}
            onInput={emitEditorValue}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => {
              composing.current = false;
              emitEditorValue();
            }}
            onPaste={onPaste}
            onDrop={onDrop}
            className="rich-editor min-h-48 w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-3 text-base leading-7 text-[#1F1A2B] focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8]"
          />
        </>
      ) : (
        <MentionTextarea
          id={id}
          className="min-h-48 text-base"
          value={stripRich(value)}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={rawOverLimit || plainOverLimit}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className={counterClass}>{plainLength}/{maxPlain} · {rawLength}/{maxRaw}</p>
        {mode === "rich" ? (
          <button type="button" className="min-h-8 text-sm font-medium text-deep-plum underline" onClick={switchToPlain} disabled={disabled}>{t("rich.simple")}</button>
        ) : (
          <button type="button" className="min-h-8 text-sm font-medium text-deep-plum underline" onClick={() => changeMode("rich")} disabled={disabled}>{t("rich.formatted")}</button>
        )}
      </div>
      <p className="break-words text-sm text-gray-600">{t("rich.tip")}</p>
      {mode === "rich" && hasMention(stripRich(value)) && <p className="break-words text-sm leading-6 text-gray-600">{t("mention.rules")}</p>}
    </div>
  );
}
