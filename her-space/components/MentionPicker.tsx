"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { useLanguage } from "@/components/LanguageProvider";
import Avatar from "@/components/Avatar";

export type MentionMember = {
  id: string;
  display_name: string | null;
  avatar: string | null;
  username: string;
};

type SearchResult = {
  query: string;
  members: MentionMember[];
  error: string;
};

export default function MentionPicker({
  query,
  onSelect,
  onResultsChange,
}: {
  query: string;
  onSelect: (member: MentionMember) => void;
  onResultsChange?: (members: MentionMember[]) => void;
}) {
  const { t } = useLanguage();
  const [result, setResult] = useState<SearchResult | null>(null);
  const current = result?.query === query ? result : null;

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase.rpc("search_members", { p_query: query, p_limit: 6 });
          if (error) throw error;
          const members = ((data ?? []) as MentionMember[])
            .filter((member) => typeof member.username === "string")
            .slice(0, 6);
          if (!active) return;
          setResult({ query, members, error: "" });
          onResultsChange?.(members);
        } catch (error) {
          if (!active) return;
          setResult({ query, members: [], error: friendlyError(error, t) });
          onResultsChange?.([]);
        }
      })();
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [onResultsChange, query, t]);

  return (
    <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-soft-lilac bg-white p-2 shadow-xl">
      {current?.error ? (
        <p className="break-words px-2 py-1 text-sm text-red-700" role="alert">{current.error}</p>
      ) : current?.members.length ? (
        <ul className="space-y-1" role="listbox" aria-label={t("mention.button")}>
          {current.members.map((member) => {
            const name = member.display_name?.trim() || t("common.herSpaceMember");
            return (
              <li key={member.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-soft-lilac/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(member)}
                >
                  <Avatar name={name} avatar={member.avatar} size={32} />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium text-deep-plum">{name}</span>
                    <span className="block break-words text-xs text-gray-500">@{member.username}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : current ? (
        <p className="break-words px-2 py-1 text-sm text-gray-600">{t("mention.noResults")}</p>
      ) : (
        <p className="px-2 py-1 text-sm text-gray-600" role="status">{t("common.loading")}</p>
      )}
      <p className="break-words border-t border-soft-lilac/70 px-2 pt-2 text-xs leading-5 text-gray-600">{t("mention.hint")}</p>
    </div>
  );
}
