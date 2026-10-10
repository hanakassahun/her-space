"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import SuccessCheck from "@/components/ui/SuccessCheck";
import { useLanguage } from "@/components/LanguageProvider";

type PostType = "experience" | "question" | "knowledge";
type Provenance = "personal" | "community" | "evidence";

export default function NewPostPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [type, setType] = useState<PostType>("experience");
  const [provenance, setProvenance] = useState<Provenance>("personal");
  const [sources, setSources] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topics, setTopics] = useState("");
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search);
      const sharedTitle = query.get("title");
      const sharedTopics = query.get("topics");
      if (sharedTitle) setTitle(sharedTitle);
      if (sharedTopics) setTopics(sharedTopics);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

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
      topics: topics
        .split(/[,،፣]/)
        .map((topic) => topic.trim())
        .filter(Boolean),
    });

    if (error) {
      setMessage(friendlyError(error, t));
      setLoading(false);
      return;
    }

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
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm font-medium text-gray-900">
            {t("new.type")}
            <select
              className="min-h-11 w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-2.5 text-deep-plum focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8]"
              value={type}
              onChange={(event) => {
                const nextType = event.target.value as PostType;
                setType(nextType);
                setProvenance(nextType === "experience" ? "personal" : "community");
                setSources("");
              }}
            >
              <option value="experience">{t("new.experience")}</option>
              <option value="question">{t("new.question")}</option>
              <option value="knowledge">{t("new.knowledge")}</option>
            </select>
          </label>

          <label className="block space-y-2 text-sm font-medium text-gray-900">
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
            <label className="block space-y-2 text-sm font-medium text-gray-900">
              {t("new.sourceLinks")}
              <Textarea
                className="min-h-28"
                placeholder={t("new.sourcePlaceholder")}
                value={sources}
                onChange={(event) => setSources(event.target.value)}
                required
              />
            </label>
          )}

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            {t("common.title")}
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            {t("common.body")}
            <Textarea
              className="min-h-40 resize-y"
              rows={6}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-gray-900">
            {t("common.topics")}
            <Input
              placeholder={t("new.topicsPlaceholder")}
              value={topics}
              onChange={(event) => setTopics(event.target.value)}
            />
          </label>

          {message && (
            <p className={`inline-flex items-center gap-2 text-sm ${published ? "text-emerald-800" : "text-red-600"}`} role="status">
              {published && <SuccessCheck />}
              {message}
            </p>
          )}
          <p className="flex items-start gap-2 text-xs leading-5 text-gray-600">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            {t("new.visibility")}
          </p>
          <Button
            className="w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? t("new.publishing") : t("new.publish")}
          </Button>
        </form>
        </Card>
    </PageShell>
  );
}