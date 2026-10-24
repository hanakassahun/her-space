"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type SuggestedMember = {
  id: string;
  display_name: string | null;
  bio: string | null;
  shared_topics: string[] | null;
};

const HIDE_KEY = "hideSuggestions";
const HIDE_DURATION = 7 * 24 * 60 * 60 * 1000;

export default function SuggestedMembers() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [members, setMembers] = useState<SuggestedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadSuggestions() {
      try {
        const hiddenAt = Number(window.localStorage.getItem(HIDE_KEY));
        if (Number.isFinite(hiddenAt) && hiddenAt > 0 && Date.now() - hiddenAt < HIDE_DURATION) {
          if (active) setHidden(true);
          return;
        }
        window.localStorage.removeItem(HIDE_KEY);
      } catch {
        // Suggestions remain available if local storage is unavailable.
      }

      try {
        const { data, error } = await supabase.rpc("suggest_members", { p_limit: 8 });
        if (!active || error) return;
        setMembers((data ?? []) as SuggestedMember[]);
      } catch {
        // Suggestions are optional; keep the row hidden on request failures.
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSuggestions();
    return () => {
      active = false;
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(HIDE_KEY, String(Date.now()));
    } catch {
      // The row stays hidden for this page view if storage is unavailable.
    }
  }

  async function follow(memberId: string) {
    if (!user || followedIds.includes(memberId) || pendingIds.includes(memberId)) return;
    setFollowedIds((current) => [...current, memberId]);
    setPendingIds((current) => [...current, memberId]);

    try {
      const { error } = await supabase.from("follows").insert({ followee_id: memberId });
      if (error) setFollowedIds((current) => current.filter((id) => id !== memberId));
    } catch {
      setFollowedIds((current) => current.filter((id) => id !== memberId));
    } finally {
      setPendingIds((current) => current.filter((id) => id !== memberId));
    }
  }

  if (loading || hidden || members.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="suggested-members-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="suggested-members-heading" className="text-lg font-semibold text-deep-plum">
          {t("suggest.title")}
        </h2>
        <Button
          variant="ghost"
          className="shrink-0 px-3 text-sm"
          type="button"
          onClick={dismiss}
        >
          {t("suggest.dismiss")}
        </Button>
      </div>
      <div className="hide-scrollbar flex snap-x gap-3 overflow-x-auto pb-2">
        {members.map((member) => {
          const displayName = member.display_name?.trim() || t("common.herSpaceMember");
          const sharedTopics = (member.shared_topics ?? []).slice(0, 2);
          const followed = followedIds.includes(member.id);
          return (
            <Card
              as="article"
              key={member.id}
              className="w-64 shrink-0 snap-start space-y-3 p-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="gradient-aurora flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" aria-hidden="true">
                  {displayName.trim().charAt(0).toLocaleUpperCase() || "H"}
                </span>
                <Link className="min-w-0 break-words font-medium text-deep-plum underline" href={`/u/${member.id}`}>
                  {displayName}
                </Link>
              </div>
              <p className="line-clamp-1 break-words text-sm text-gray-600">{member.bio || " "}</p>
              {sharedTopics.length > 0 && (
                <div className="space-y-1">
                  <p className="break-words text-xs text-gray-600">{t("suggest.shared")}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {sharedTopics.map((topic) => (
                      <li key={topic}><Badge className="max-w-full whitespace-normal break-words">{topic}</Badge></li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                variant={followed ? "secondary" : "primary"}
                className="w-full px-3 text-sm"
                type="button"
                disabled={followed || pendingIds.includes(member.id)}
                onClick={() => void follow(member.id)}
              >
                {followed ? t("profile.following") : t("profile.follow")}
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
