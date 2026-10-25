"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import SuccessCheck from "@/components/ui/SuccessCheck";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/en";
import { useAuth } from "@/components/AuthProvider";

type PostType = "experience" | "question" | "knowledge";
type Provenance = "personal" | "community" | "evidence";
type AgeGroup = "teen" | "adult";
type QuotedSource = {
  id: string;
  title: string;
  body: string;
  type: PostType;
  provenance: Provenance;
  allow_reposts: boolean;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

function defaultAllowReposts(postType: PostType, postProvenance: Provenance) {
  return postType === "knowledge" || postProvenance === "evidence";
}

type Draft = {
  title: string;
  body: string;
  type: PostType;
  provenance: Provenance;
  topics: string[];
  extraTopics: string;
  sources: string;
  sensitive: boolean;
};

const topicOptions = [
  "periods", "hormones", "PCOS", "fertility", "contraception", "sexual health", "breast health",
  "skin", "hair", "hygiene", "mental health", "relationships", "confidence", "puberty",
  "pregnancy", "postpartum", "menopause",
];

const starterKeys: Record<PostType, readonly TranslationKey[]> = {
  experience: ["write.starterExp1", "write.starterExp2", "write.starterExp3"],
  question: ["write.starterQ1", "write.starterQ2"],
  knowledge: ["write.starterK1", "write.starterK2"],
};

const typeDescriptionKeys: Record<PostType, TranslationKey> = {
  experience: "write.typeExpDesc",
  question: "write.typeQuestionDesc",
  knowledge: "write.typeKnowledgeDesc",
};

const PostPreview = dynamic(() => import("@/components/PostPreview"), { ssr: false });

function parseTopicText(value: string) {
  return value.split(/[,،፣]/).map((topic) => topic.trim()).filter(Boolean);
}

function hasDraftContent(draft: Draft) {
  return Boolean(
    draft.title.trim() || draft.body.trim() || draft.topics.length || draft.extraTopics.trim() || draft.sources.trim()
  );
}

function draftStorageKey(userId: string, quoteId: string | null) {
  return quoteId ? `draft:${userId}:quote:${quoteId}` : `draft:${userId}`;
}

export default function NewPostPage() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const currentUserId = user?.id ?? null;
  const router = useRouter();
  const [type, setType] = useState<PostType>("experience");
  const [provenance, setProvenance] = useState<Provenance>("personal");
  const [sources, setSources] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [extraTopics, setExtraTopics] = useState("");
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [allowReposts, setAllowReposts] = useState(false);
  const [ageSetting, setAgeSetting] = useState<{ userId: string; ageGroup: AgeGroup } | null>(null);
  const [adultsOnly, setAdultsOnly] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quotedPost, setQuotedPost] = useState<QuotedSource | null>(null);
  const [quoteChecked, setQuoteChecked] = useState(false);
  const [quoteUnavailable, setQuoteUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const ageGroup = ageSetting?.userId === currentUserId ? ageSetting.ageGroup : null;

  function clearDraftFor(id: string, draftQuoteId: string | null = null) {
    try {
      window.localStorage.removeItem(draftStorageKey(id, draftQuoteId));
    } catch {
      // Ignore local storage errors.
    }
  }

  useEffect(() => {
    let active = true;

    async function restoreUserDraft() {
      if (authLoading) return;
      if (!active) return;
      const requestedQuoteId = new URLSearchParams(window.location.search).get("quote");
      setQuoteId(requestedQuoteId);
      setQuoteUnavailable(false);
      let sourcePost: QuotedSource | null = null;
      if (requestedQuoteId) {
        const { data, error } = await supabase
          .from("posts")
          .select("id, title, body, type, provenance, allow_reposts, profiles!posts_author_id_fkey(display_name)")
          .eq("id", requestedQuoteId)
          .maybeSingle();
        if (!active) return;
        if (error || !data || !data.allow_reposts) {
          setQuotedPost(null);
          setQuoteUnavailable(true);
          setQuoteChecked(true);
          setDraftReady(true);
          return;
        }
        sourcePost = data as QuotedSource;
        setQuotedPost(sourcePost);
      } else {
        setQuotedPost(null);
      }
      setQuoteChecked(true);
      const previousUserId = userIdRef.current;
      if (previousUserId && !currentUserId) clearDraftFor(previousUserId, requestedQuoteId);
      userIdRef.current = currentUserId;
      setUserId(currentUserId);
      setAdultsOnly(false);

      if (currentUserId) {
        void (async () => {
          try {
            const { data, error } = await supabase
              .from("member_private")
              .select("age_group")
              .eq("user_id", currentUserId)
              .maybeSingle();
            if (!active || error) return;
            if (data?.age_group === "teen" || data?.age_group === "adult") {
              setAgeSetting({ userId: currentUserId, ageGroup: data.age_group });
            }
          } catch {
            // Keep adult-only publishing unavailable if the age row cannot be read.
          }
        })();
      }

      let restored = false;
      if (currentUserId) {
        try {
          const stored = window.localStorage.getItem(draftStorageKey(currentUserId, requestedQuoteId));
          if (stored) {
            const draft = JSON.parse(stored) as Draft;
            if (draft && hasDraftContent(draft)) {
              setTitle(draft.title ?? "");
              setBody(draft.body ?? "");
              setType(draft.type ?? "experience");
              setProvenance(draft.provenance ?? "personal");
              setTopics(Array.isArray(draft.topics) ? draft.topics : []);
              setExtraTopics(draft.extraTopics ?? "");
              setSources(draft.sources ?? "");
              setSensitive(Boolean(draft.sensitive));
              setAllowReposts(!draft.sensitive && defaultAllowReposts(draft.type ?? "experience", draft.provenance ?? "personal"));
              setDraftRestored(true);
              restored = true;
            }
          }
        } catch {
          // Ignore malformed or unavailable local storage data.
        }
      }

      if (!restored) {
        if (sourcePost) {
          const titlePrefix = `${t("quote.titlePrefix")} `;
          const originalTitle = sourcePost.title.trim();
          setTitle(`${titlePrefix}${originalTitle.slice(0, Math.max(0, 150 - titlePrefix.length))}`);
          setBody("");
          setExtraTopics("");
        } else {
          const query = new URLSearchParams(window.location.search);
          const sharedTitle = query.get("title");
          const sharedTopics = query.get("topics");
          if (sharedTitle) setTitle(sharedTitle);
          if (sharedTopics) setExtraTopics(sharedTopics);
        }
      }
      setDraftReady(true);
    }

    void restoreUserDraft();
    return () => {
      active = false;
    };
  }, [authLoading, currentUserId]);

  useEffect(() => {
    if (!draftReady || !userId) return;
    const draft: Draft = { title, body, type, provenance, topics, extraTopics, sources, sensitive };
    const timeout = window.setTimeout(() => {
      try {
        const key = draftStorageKey(userId, quoteId);
        if (hasDraftContent(draft)) window.localStorage.setItem(key, JSON.stringify(draft));
        else window.localStorage.removeItem(key);
      } catch {
        // Ignore local storage errors.
      }
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [body, draftReady, extraTopics, provenance, quoteId, sensitive, sources, title, topics, type, userId]);

  function discardDraft() {
    if (userId) clearDraftFor(userId, quoteId);
    setDraftRestored(false);
    setTitle("");
    setBody("");
    setType("experience");
    setProvenance("personal");
    setTopics([]);
    setExtraTopics("");
    setSources("");
    setSensitive(false);
    setAllowReposts(false);
  }

  function toggleTopic(topic: string) {
    setTopics((current) => {
      if (current.includes(topic)) return current.filter((item) => item !== topic);
      if (new Set([...current, topic, ...parseTopicText(extraTopics)]).size > 5) return current;
      return [...current, topic];
    });
  }

  function removeTopic(topic: string) {
    setTopics((current) => current.filter((item) => item !== topic));
    setExtraTopics((current) => parseTopicText(current).filter((item) => item !== topic).join(", "));
  }

  function addStarter(starter: string) {
    setBody((current) => current.trim() ? `${current}\n${starter}` : starter);
  }

  const mergedTopics = [...new Set([...topics, ...parseTopicText(extraTopics)].map((topic) => topic.trim()).filter(Boolean))].slice(0, 5);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setPublished(false);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    const currentUserId = userData.user.id;

    const sourceList = sources
      .split("\n")
      .map((source) => source.trim())
      .filter(Boolean);
    if (provenance === "evidence" && sourceList.length === 0) {
      setMessage(t("new.evidenceNeedsSource"));
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("posts").insert({
      type,
      provenance,
      sources: provenance === "evidence" ? sourceList : [],
      title: title.trim(),
      body: body.trim(),
      topics: mergedTopics,
      sensitive,
      audience: ageGroup === "adult" && adultsOnly ? "adult" : "all",
      allow_reposts: allowReposts && !sensitive && !adultsOnly,
      ...(quoteId ? { quoted_post_id: quoteId } : {}),
    });

    if (error) {
      setMessage(friendlyError(error, t));
      setLoading(false);
      return;
    }

    setDraftReady(false);
    clearDraftFor(currentUserId, quoteId);
    setDraftRestored(false);
    setPublished(true);
    setMessage(t("new.published"));
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    router.push("/feed");
  }

  const quoteProfile = quotedPost
    ? Array.isArray(quotedPost.profiles) ? quotedPost.profiles[0] : quotedPost.profiles
    : null;
  const visibleStarterKeys: readonly TranslationKey[] = quotedPost
    ? ["quote.starter1", "quote.starter2", "quote.starter3"]
    : starterKeys[type];

  if (!quoteChecked) {
    return (
      <PageShell className="max-w-3xl space-y-6">
        <Card as="div" className="space-y-4" aria-busy="true">
          <div className="h-7 w-2/3 animate-pulse rounded bg-soft-lilac/60" />
          <div className="h-24 animate-pulse rounded-xl bg-soft-lilac/40" />
        </Card>
      </PageShell>
    );
  }

  if (quoteUnavailable) {
    return (
      <PageShell className="max-w-3xl px-4 py-6 md:px-6 md:py-10">
        <Card className="space-y-4">
          <p className="break-words text-gray-700">{t("quote.unavailable")}</p>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#CDBDEB] bg-white px-5 py-2 text-sm font-semibold text-deep-plum shadow-sm transition-colors hover:bg-soft-lilac/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
            href="/feed"
          >
            {t("empty.browseFeed")}
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-deep-plum">{t("new.title")}</h1>
      </div>

      <Card as="div" className="space-y-4">
        {draftRestored && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-soft-lilac/40 px-3 py-2">
            <p className="text-sm text-gray-700">{t("write.draftRestored")}</p>
            <Button variant="ghost" type="button" className="text-sm" onClick={discardDraft}>
              {t("write.discardDraft")}
            </Button>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          {quotedPost && (
            <div className="space-y-2 rounded-xl border border-soft-lilac/70 bg-white/70 p-4">
              <h2 className="text-xs font-semibold text-gray-600">{t("quote.heading")}</h2>
              <p className="break-words text-sm font-medium text-deep-plum">{quoteProfile?.display_name || "Her Space member"}</p>
              <p className="line-clamp-2 break-words font-semibold text-gray-900">{quotedPost.title}</p>
              <p className="line-clamp-4 break-words text-sm leading-6 text-gray-700">{quotedPost.body}</p>
            </div>
          )}
          {preview ? (
            <PostPreview
              type={type}
              provenance={provenance}
              sources={sources.split("\n").map((source) => source.trim()).filter(Boolean)}
              title={title}
              body={body}
              topics={mergedTopics}
              sensitive={sensitive}
              t={t}
              onKeepEditing={() => setPreview(false)}
            />
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-deep-plum">{t("write.chooseType")}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["experience", "question", "knowledge"] as const).map((postType) => (
                    <Button
                      key={postType}
                      variant={type === postType ? "primary" : "secondary"}
                      className={`h-auto min-h-[84px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-center ${type === postType ? "shadow-glow" : ""}`}
                      type="button"
                      aria-pressed={type === postType}
                      onClick={() => {
                        setType(postType);
                        const nextProvenance = postType === "experience" ? "personal" : "community";
                        setProvenance(nextProvenance);
                        setSources("");
                        setAllowReposts(!sensitive && !adultsOnly && defaultAllowReposts(postType, nextProvenance));
                      }}
                    >
                      {postType === "experience" ? (
                        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" /></svg>
                      ) : postType === "question" ? (
                        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-.9.9-1.8 1.1-1.8 2.3M12 16.5h.01" /></svg>
                      ) : (
                        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>
                      )}
                      <span className="w-full break-normal text-sm font-semibold leading-tight hyphens-none text-center [overflow-wrap:normal]">{t(`new.${postType}` as const)}</span>
                    </Button>
                  ))}
                </div>
                <p className="text-sm leading-snug text-gray-600">
                  {t(typeDescriptionKeys[type])}
                </p>
              </fieldset>

              <label className="block text-sm font-medium text-deep-plum">
                {t("common.title")}
                <Input
                  className="write-title-input mt-1 !rounded-none !border-x-0 !border-t-0 !border-b-2 !border-b-[#CDBDEB] !bg-transparent !px-1 !pb-2 !pt-1 !text-[22px] !font-medium placeholder:text-[#9d8fad] focus:!border-b-[#8F72BE] focus:!ring-0"
                  maxLength={150}
                  placeholder={t("write.titlePlaceholder")}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
                {title.length > 120 && <span className="block text-right text-xs font-normal text-gray-600">{title.length}/150</span>}
              </label>

              {!body.trim() && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-deep-plum">{t("write.starters")}</p>
                  <div className="hide-scrollbar flex snap-x gap-2 overflow-x-auto pb-1 pr-3">
                    {visibleStarterKeys.map((key) => (
                      <Button key={key} variant="secondary" type="button" className="shrink-0 snap-start whitespace-nowrap px-3 text-xs" onClick={() => addStarter(t(key))}>
                        {t(key)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <label className="block space-y-2 text-sm font-medium text-deep-plum">
                {t("common.body")}
                <Textarea
                  className="min-h-40 resize-y"
                  rows={6}
                  maxLength={5000}
                  placeholder={t(quotedPost ? "quote.bodyPlaceholder" : "write.bodyPlaceholder")}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                />
                {body.length > 4000 && <span className="block text-right text-xs font-normal text-gray-600">{body.length}/5000</span>}
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#CDBDEB] bg-white px-3 py-1.5 text-sm font-medium text-deep-plum shadow-sm hover:bg-soft-lilac/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                    aria-expanded={topicsExpanded}
                    onClick={() => setTopicsExpanded((current) => !current)}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    {t("write.addTopics")}
                    <svg className={`h-3.5 w-3.5 shrink-0 transition-transform ${topicsExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  <span className="text-xs text-gray-600">{mergedTopics.length}/5</span>
                </div>
                {mergedTopics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {mergedTopics.map((topic) => (
                      <Button
                        key={topic}
                        variant="secondary"
                        type="button"
                        className="max-w-full whitespace-normal break-words px-3 text-sm"
                        aria-label={`${topic} ×`}
                        onClick={() => removeTopic(topic)}
                      >
                        <span className="break-words">{topic}</span><span aria-hidden="true" className="ml-1">×</span>
                      </Button>
                    ))}
                  </div>
                )}
                {topicsExpanded && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {topicOptions.map((topic) => {
                        const selected = topics.includes(topic);
                        return (
                          <Button
                            key={topic}
                            variant={selected ? "primary" : "secondary"}
                            className="min-h-11 max-w-full break-words px-3 text-sm"
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleTopic(topic)}
                          >
                            {topic}
                          </Button>
                        );
                      })}
                    </div>
                    <Input
                      value={extraTopics}
                      onChange={(event) => setExtraTopics(event.target.value)}
                      placeholder={t("write.otherTopics")}
                      aria-label={t("write.otherTopics")}
                    />
                  </div>
                )}
              </div>

              <label className="block space-y-2 text-sm font-medium text-deep-plum">
                {t("new.provenance")}
                <select
                  className="min-h-11 w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-2.5 text-deep-plum focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8]"
                  value={provenance}
                  onChange={(event) => {
                    const nextProvenance = event.target.value as Provenance;
                    setProvenance(nextProvenance);
                    setAllowReposts(!sensitive && !adultsOnly && defaultAllowReposts(type, nextProvenance));
                    if (nextProvenance !== "evidence") setSources("");
                  }}
                >
                  <option value="personal">{t("new.personal")}</option>
                  <option value="community">{t("new.community")}</option>
                  <option value="evidence">{t("new.evidence")}</option>
                </select>
              </label>

              {provenance === "evidence" && (
                <label className="block space-y-2 text-sm font-medium text-deep-plum">
                  {t("new.sourceLinks")}
                  <Textarea className="min-h-28" placeholder={t("new.sourcePlaceholder")} value={sources} onChange={(event) => setSources(event.target.value)} required />
                </label>
              )}

              <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#CDBDEB] bg-white p-3">
                <span className="min-w-0">
                  <span className="block break-words text-sm font-medium text-deep-plum">{t("write.sensitive")}</span>
                  <span className="mt-1 block break-words text-xs leading-5 text-gray-600">{t("write.sensitiveHint")}</span>
                </span>
                <button
                  className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${sensitive ? "gradient-aurora border-transparent" : "border-[#CDBDEB] bg-soft-lilac/40"}`}
                  type="button"
                  role="switch"
                  aria-checked={sensitive}
                  aria-label={t("write.sensitive")}
                  onClick={() => setSensitive((current) => {
                    const next = !current;
                    if (next) setAllowReposts(false);
                    return next;
                  })}
                >
                  <span className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${sensitive ? "translate-x-7" : "translate-x-0"}`} />
                </button>
              </div>

              {ageGroup === "adult" && (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#CDBDEB] bg-white p-3">
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-deep-plum">{t("audience.adultsOnly")}</span>
                      <span className="mt-1 block break-words text-xs leading-5 text-gray-600">{t("audience.adultsHint")}</span>
                    </span>
                    <button
                      className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${adultsOnly ? "gradient-aurora border-transparent" : "border-[#CDBDEB] bg-soft-lilac/40"}`}
                      type="button"
                      role="switch"
                      aria-checked={adultsOnly}
                      aria-label={t("audience.adultsOnly")}
                      onClick={() => setAdultsOnly((current) => {
                        const next = !current;
                        if (next) setAllowReposts(false);
                        return next;
                      })}
                    >
                      <span className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${adultsOnly ? "translate-x-7" : "translate-x-0"}`} />
                    </button>
                  </div>
                  {!adultsOnly && mergedTopics.some((topic) => ["sexual health", "contraception"].includes(topic.toLowerCase())) && (
                    <p className="break-words text-xs leading-5 text-gray-600">{t("audience.suggest")}</p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#CDBDEB] bg-white p-3">
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium text-deep-plum">{t("repost.allow")}</span>
                    <span className="mt-1 block break-words text-xs leading-5 text-gray-600">{t("repost.allowHint")}</span>
                  </span>
                  <button
                    className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${allowReposts ? "gradient-aurora border-transparent" : "border-[#CDBDEB] bg-soft-lilac/40"}`}
                    type="button"
                    role="switch"
                    aria-checked={allowReposts && !sensitive && !adultsOnly}
                    aria-label={t("repost.allow")}
                    disabled={sensitive || adultsOnly}
                    onClick={() => setAllowReposts((current) => !current)}
                  >
                    <span className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${allowReposts ? "translate-x-7" : "translate-x-0"}`} />
                  </button>
                </div>
                {(sensitive || adultsOnly) && <p className="break-words text-xs text-gray-600">{t("repost.unavailable")}</p>}
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-soft-lilac/30 px-3 py-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-deep-plum/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <p className="text-[13px] leading-snug text-gray-600">
                  {t("write.privacyTip")}{" "}{t("new.visibility")}
                </p>
              </div>
            </>
          )}

          {message && (
            <div className={`break-words text-sm ${published ? "text-emerald-800" : "text-red-600"}`} role="status">
              <div className="flex items-center gap-2">
                {published && <SuccessCheck />}
                <FriendlyErrorMessage message={message} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {!preview && (
              <Button variant="secondary" className="flex-1" type="button" onClick={() => setPreview(true)}>
                {t("write.preview")}
              </Button>
            )}
            <Button className="publish-submit flex-1" type="submit" disabled={loading || !title.trim() || !body.trim()}>
              {loading ? t("new.publishing") : t("new.publish")}
            </Button>
          </div>
          {(!title.trim() || !body.trim()) && (
            <p className="text-center text-xs text-gray-600">{t("write.publishHint")}</p>
          )}
        </form>
      </Card>
    </PageShell>
  );
}