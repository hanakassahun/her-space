"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/en";

type Article = {
  id: string;
  slug: string;
  title: string;
  title_am: string | null;
  summary: string;
  summary_am: string | null;
  category: string;
  topics: string[];
  normal: string;
  normal_am: string | null;
  needs_attention: string;
  needs_attention_am: string | null;
  see_doctor: string;
  see_doctor_am: string | null;
  doctor_questions: string[];
  doctor_questions_am: string[];
  sources: string[];
  reviewed_by: string | null;
};

const categoryTranslationKeys: Record<string, TranslationKey> = {
  health: "explore.health",
  body_beauty: "explore.bodyBeauty",
  mind_life: "explore.mindLife",
  life_stages: "explore.lifeStages",
};

export default function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadArticle() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("articles")
        .select("id, slug, title, title_am, summary, summary_am, category, topics, normal, normal_am, needs_attention, needs_attention_am, see_doctor, see_doctor_am, doctor_questions, doctor_questions_am, sources, reviewed_by")
        .eq("slug", slug)
        .eq("published", true)
        .single();

      if (error) setMessage(friendlyError(error, t));
      else setArticle(data as Article);
      setLoading(false);
    }

    void loadArticle();
  }, [router, slug]);

  const articleText = article ? {
    title: lang === "am" && article.title_am?.trim() ? article.title_am : article.title,
    summary: lang === "am" && article.summary_am?.trim() ? article.summary_am : article.summary,
    normal: lang === "am" && article.normal_am?.trim() ? article.normal_am : article.normal,
    attention: lang === "am" && article.needs_attention_am?.trim() ? article.needs_attention_am : article.needs_attention,
    doctor: lang === "am" && article.see_doctor_am?.trim() ? article.see_doctor_am : article.see_doctor,
    questions: lang === "am" && article.doctor_questions_am?.length ? article.doctor_questions_am : article.doctor_questions,
    untranslated: lang === "am" && (
      !article.title_am?.trim() ||
      !article.summary_am?.trim() ||
      !article.normal_am?.trim() ||
      !article.needs_attention_am?.trim() ||
      !article.see_doctor_am?.trim() ||
      !article.doctor_questions_am?.length
    ),
  } : null;

  return (
    <PageShell className="max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      {loading && <p className="text-gray-700">Loading article...</p>}
      {message && <Card className="text-red-700">{message}</Card>}

      {article && (
        <>
          <header className="space-y-3">
            <Badge variant="lilac">{t(categoryTranslationKeys[article.category] ?? "explore.health")}</Badge>
            <h1 className="text-3xl font-bold text-deep-plum">{articleText?.title}</h1>
            <p className="text-lg leading-7 text-gray-700">{articleText?.summary}</p>
            {article.topics.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Article topics">
                {article.topics.map((topic) => (
                  <li key={topic}><Badge variant="sky">{topic}</Badge></li>
                ))}
              </ul>
            )}
          </header>

          {articleText?.untranslated && (
            <p className="rounded-xl bg-soft-lilac/50 px-3 py-2 text-xs text-deep-plum">
              {t("learn.notTranslated")}
            </p>
          )}

          <Card as="section" className="space-y-3 border-l-4 border-l-emerald-300 bg-emerald-50/75">
            <h2 className="text-xl font-semibold text-emerald-950">{t("learn.normal")}</h2>
            <p className="whitespace-pre-wrap leading-7 text-gray-800">{articleText?.normal}</p>
          </Card>

          <Card as="section" className="space-y-3 border-l-4 border-l-amber-300 bg-amber-50/75">
            <h2 className="text-xl font-semibold text-amber-950">{t("learn.attention")}</h2>
            <p className="whitespace-pre-wrap leading-7 text-gray-800">{articleText?.attention}</p>
          </Card>

          <Card as="section" className="space-y-3 border-l-4 border-l-rose-300 bg-rose-50/75">
            <h2 className="text-xl font-semibold text-rose-950">{t("learn.seeDoctor")}</h2>
            <p className="whitespace-pre-wrap leading-7 text-gray-800">{articleText?.doctor}</p>
          </Card>

          <Card as="section" className="space-y-3 border-l-4 border-l-sky-300 bg-sky-50/75">
            <h2 className="text-xl font-semibold text-sky-950">{t("learn.doctorQuestions")}</h2>
            <ul className="list-disc space-y-2 pl-5 leading-7 text-gray-800">
              {articleText?.questions.map((question, index) => (
                <li key={`${question}-${index}`}>{question}</li>
              ))}
            </ul>
          </Card>

          {article.sources.length > 0 && (
            <section className="space-y-3" aria-labelledby="sources-heading">
              <h2 id="sources-heading" className="text-xl font-semibold text-deep-plum">{t("learn.sources")}</h2>
              <ul className="list-disc space-y-2 pl-5">
                {article.sources.map((source, index) => (
                  <li key={`${source}-${index}`}>
                    <a
                      className="break-all text-teal-900 underline"
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {article.reviewed_by && (
            <p className="text-sm text-gray-700">{t("learn.reviewedBy")} {article.reviewed_by}</p>
          )}

          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
            {t("learn.educationNote")}
          </p>
        </>
      )}
    </PageShell>
  );
}