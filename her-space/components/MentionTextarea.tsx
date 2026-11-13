"use client";

import { useRef, useState, type TextareaHTMLAttributes } from "react";
import Textarea from "@/components/ui/Textarea";
import MentionPicker, { type MentionMember } from "@/components/MentionPicker";
import { useLanguage } from "@/components/LanguageProvider";
import { hasMention } from "@/lib/mentions";

type Fragment = { start: number; end: number; query: string };
type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export default function MentionTextarea({ value, onChange, ...textareaProps }: Props) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const [fragment, setFragment] = useState<Fragment | null>(null);
  const [suggestions, setSuggestions] = useState<MentionMember[]>([]);

  function updateFragment(text: string, caret: number) {
    const prefix = text.slice(0, caret);
    const match = /(^|[^A-Za-z0-9_@])@([A-Za-z][A-Za-z0-9_]{0,19})$/.exec(prefix);
    if (!match) {
      setFragment(null);
      setSuggestions([]);
      return;
    }
    const end = caret;
    const start = end - match[2].length - 1;
    setFragment({ start, end, query: `@${match[2]}` });
  }

  function chooseMember(member: MentionMember) {
    if (!fragment) return;
    const inserted = `@${member.username} `;
    const next = `${value.slice(0, fragment.start)}${inserted}${value.slice(fragment.end)}`;
    onChange(next);
    const caret = fragment.start + inserted.length;
    setFragment(null);
    setSuggestions([]);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          {...textareaProps}
          ref={textareaRef}
          value={value}
          aria-autocomplete={fragment ? "list" : undefined}
          aria-expanded={fragment ? true : undefined}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next);
            if (!composing.current && event.target.selectionStart === event.target.selectionEnd) {
              updateFragment(next, event.target.selectionStart);
            } else {
              setFragment(null);
            }
          }}
          onKeyDown={(event) => {
            textareaProps.onKeyDown?.(event);
            if (event.defaultPrevented || event.nativeEvent.isComposing || composing.current) return;
            if (event.key === "Escape" && fragment) {
              event.preventDefault();
              setFragment(null);
              setSuggestions([]);
            } else if (event.key === "Enter" && fragment && suggestions[0]) {
              event.preventDefault();
              chooseMember(suggestions[0]);
            }
          }}
          onCompositionStart={(event) => {
            composing.current = true;
            setFragment(null);
            textareaProps.onCompositionStart?.(event);
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            updateFragment(event.currentTarget.value, event.currentTarget.selectionStart);
            textareaProps.onCompositionEnd?.(event);
          }}
        />
        {fragment && (
          <div className="absolute left-0 top-full z-30 mt-2 w-full max-w-sm">
            <MentionPicker query={fragment.query} onSelect={chooseMember} onResultsChange={setSuggestions} />
          </div>
        )}
      </div>
      {hasMention(value) && <p className="break-words text-sm leading-6 text-gray-600">{t("mention.rules")}</p>}
    </div>
  );
}
