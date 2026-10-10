"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import SuccessCheck from "@/components/ui/SuccessCheck";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import UserText from "@/components/UserText";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/en";

type PostType = "experience" | "question" | "knowledge";
type Provenance = "personal" | "community" | "evidence";
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

const typeVariants: Record<PostType, "rose" | "sky" | "mint"> = {
  experience: "rose",
  question: "sky",
  knowledge: "mint",
};

function parseTopicText(value: string) {
  return value.split(/[,،፣]/).map((topic) => topic.trim()).filter(Boolean);
}

function hasDraftContent(draft: Draft) {
  return Boolean(
    draft.title.trim() || draft.body.trim() || draft.topics.length || draft.extraTopics.trim() || draft.sources.trim()
  );
}

export default function NewPostPage() {
  const { t } = useLanguage();
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
  const [userId, setUserId] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);

  function clearDraftFor(id: string) {
    try {
      window.localStorage.removeItem(`draft:${id}`);
    } catch {
      // Ignore local storage errors.
    }
  }

  useEffect(() => {
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      const currentUserId = userIdRef.current;
      if (currentUserId) clearDraftFor(currentUserId);
      userIdRef.current = null;
      setUserId(null);
    });

    async function restoreUserDraft() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      const currentUserId = data.user?.id ?? null;
      userIdRef.current = currentUserId;
      setUserId(currentUserId);

      let restored = false;
      if (currentUserId) {
        try {
          const stored = window.localStorage.getItem(`draft:${currentUserId}`);
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
              setDraftRestored(true);
              restored = true;
            }
          }
        } catch {
          // Ignore malformed or unavailable local storage data.
        }
      }

      if (!restored) {
        const query = new URLSearchParams(window.location.search);
        const sharedTitle = query.get("title");
        const sharedTopics = query.get("topics");
        if (sharedTitle) setTitle(sharedTitle);
        if (sharedTopics) setExtraTopics(sharedTopics);
      }
      setDraftReady(true);
    }

    void restoreUserDraft();
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!draftReady || !userId) return;
    const draft: Draft = { title, body, type, provenance, topics, extraTopics, sources, sensitive };
    const timeout = window.setTimeout(() => {
      try {
        const key = `draft:${userId}`;
        if (hasDraftContent(draft)) window.localStorage.setItem(key, JSON.stringify(draft));
        else window.localStorage.removeItem(key);
      } catch {
        // Ignore local storage errors.
      }
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [body, draftReady, extraTopics, provenance, sensitive, sources, title, topics, type, userId]);

  function discardDraft() {
    if (userId) clearDraftFor(userId);
    setDraftRestored(false);
    setTitle("");
    setBody("");
    setType("experience");
    setProvenance("personal");
    setTopics([]);
    setExtraTopics("");
    setSources("");
    setSensitive(false);
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
    });

    if (error) {
      setMessage(friendlyError(error, t));
      setLoading(false);
      return;
    }

    setDraftReady(false);
    clearDraftFor(currentUserId);
    setDraftRestored(false);
    setPublished(true);
    setMessage(t("new.published"));
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    router.push("/feed");
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
          {preview ? (
            <div className="space-y-4">
              <Card as="article" className="post-card space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={typeVariants[type]}>{t(`new.${type}` as const)}</Badge>
                  <ProvenanceBadge provenance={provenance} sources={sources.split("\n").map((source) => source.trim()).filter(Boolean)} />
                </div>
                <div className="space-y-2">
                  <h2 className="break-words text-xl font-semibold text-gray-900">{title || t("common.title")}</h2>
                  <UserText text={body} className="min-h-6 text-gray-800" />
                </div>
                {mergedTopics.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label={t("common.topics")}>
                    {mergedTopics.map((topic) => <li key={topic}><Badge variant="lilac">{topic}</Badge></li>)}
                  </ul>
                )}
                {sensitive && <p className="text-sm text-gray-600">{t("write.sensitive")}</p>}
              </Card>
              <Button variant="secondary" type="button" onClick={() => setPreview(false)}>
                {t("write.keepEditing")}
              </Button>
            </div>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-deep-plum">{t("write.chooseType")}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["experience", "question", "knowledge"] as const).map((postType) => (
                    <Button
                      key={postType}
                      variant={type === postType ? "primary" : "secondary"}
                      className={`h-auto min-h-[84px] w-full min-w-0 flex-col justify-center gap-1 rounded-2xl px-2 py-2 text-center ${type === postType ? "shadow-glow" : ""}`}
                      type="button"
                      aria-pressed={type === postType}
                      onClick={() => {
                        setType(postType);
                        setProvenance(postType === "experience" ? "personal" : "community");
                        setSources("");
                      }}
                    >
                      <span className="flex w-full min-w-0 flex-col items-center gap-1">
                        {postType === "experience" ? (
                          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" /></svg>
                        ) : postType === "question" ? (
                          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-.9.9-1.8 1.1-1.8 2.3M12 16.5h.01" /></svg>
                        ) : (
                          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>
                        )}
                        <span className="w-full break-words text-sm font-semibold leading-tight [overflow-wrap:anywhere]">{t(`new.${postType}` as const)}</span>
                      </span>
                    </Button>
                  ))}
                </div>
                <p className="break-words text-sm leading-snug text-gray-600">
                  {t(typeDescriptionKeys[type])}
                </p>
              </fieldset>

              <label className="block space-y-2 text-sm font-medium text-deep-plum">
                {t("common.title")}
                <Input
                  className="write-title-input !rounded-none !border-x-0 !border-t-0 !border-b-2 !border-b-[#CDBDEB] !bg-transparent !px-1 !text-[22px] !font-medium focus:!border-b-[#8F72BE] focus:!ring-0"
                  maxLength={150}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
                {title.length > 120 && <span className="block text-right text-xs font-normal text-gray-600">{title.length}/150</span>}
              </label>

              {!body.trim() && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-deep-plum">{t("write.starters")}</p>
                  <div className="flex flex-wrap gap-2">
                    {starterKeys[type].map((key) => (
                      <Button key={key} variant="secondary" type="button" className="max-w-full whitespace-normal break-words px-3 text-xs" onClick={() => addStarter(t(key))}>
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
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                />
                {body.length > 4000 && <span className="block text-right text-xs font-normal text-gray-600">{body.length}/5000</span>}
              </label>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    type="button"
                    className="justify-start px-1 text-sm font-medium"
                    aria-expanded={topicsExpanded}
                    onClick={() => setTopicsExpanded((current) => !current)}
                  >
                    {t("write.addTopics")}
                    <svg className={`ml-1 h-4 w-4 transition-transform ${topicsExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </Button>
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
                  onClick={() => setSensitive((current) => !current)}
                >
                  <span className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${sensitive ? "translate-x-7" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="space-y-2 text-sm leading-snug text-gray-600">
                <p>{t("write.privacyTip")}</p>
                <p className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="5" y="10" width="14" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  {t("new.visibility")}
                </p>
              </div>
            </>
          )}

          {message && (
            <p className={`inline-flex items-center gap-2 break-words text-sm ${published ? "text-emerald-800" : "text-red-600"}`} role="status">
              {published && <SuccessCheck />}
              {message}
            </p>
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