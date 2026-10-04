"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  topics: string[];
  normal: string;
  needs_attention: string;
  see_doctor: string;
  doctor_questions: string[];
  sources: string[];
  reviewed_by: string | null;
};

const categoryLabels: Record<string, string> = {
  health: "Health",
  body_beauty: "Body & Beauty",
  mind_life: "Mind & Life",
  life_stages: "Life stages",
};

export default function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
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
        .select("id, slug, title, summary, category, topics, normal, needs_attention, see_doctor, doctor_questions, sources, reviewed_by")
        .eq("slug", slug)
        .eq("published", true)
        .single();

      if (error) setMessage(error.message);
      else setArticle(data as Article);
      setLoading(false);
    }

    void loadArticle();
  }, [router, slug]);

  return (
    <PageShell className="max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      {loading && <p className="text-gray-700">Loading article...</p>}
      {message && <Card className="text-red-700">{message}</Card>}

      {article && (
        <>
          <header className="space-y-3">
            <Badge variant="lilac">{categoryLabels[article.category] ?? article.category}</Badge>
            <h1 className="text-3xl font-bold text-deep-plum">{article.title}</h1>
            <p className="text-lg leading-7 text-gray-700">{article.summary}</p>
            {article.topics.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Article topics">
                {article.topics.map((topic) => (
                  <li key={topic}><Badge variant="sky">{topic}</Badge></li>
                ))}
              </ul>
            )}
          </header>

          <Card as="section" className="space-y-3 border-l-4 border-l-emerald-300 bg-emerald-50/75">
            <h2 className="text-xl font-semibold text-emerald-950">What can be normal</h2>
            <p className="whitespace-pre-wrap leading-7 text-gray-800">{article.normal}</p>
          </Card>

          <Card as="section" className="space-y-3 border-l-4 border-l-amber-300 bg-amber-50/75">
            <h2 className="text-xl font-semibold text-amber-950">What may deserve attention</h2>
            <p className="whitespace-pre-wrap leading-7 text-gray-800">{article.needs_attention}</p>
          </Card>

          <Card as="section" className="space-y-3 border-l-4 border-l-rose-300 bg-rose-50/75">
            <h2 className="text-xl font-semibold text-rose-950">When to see a doctor</h2>
            <p className="whitespace-pre-wrap leading-7 text-gray-800">{article.see_doctor}</p>
          </Card>

          <Card as="section" className="space-y-3 border-l-4 border-l-sky-300 bg-sky-50/75">
            <h2 className="text-xl font-semibold text-sky-950">Questions to ask your doctor</h2>
            <ul className="list-disc space-y-2 pl-5 leading-7 text-gray-800">
              {article.doctor_questions.map((question, index) => (
                <li key={`${question}-${index}`}>{question}</li>
              ))}
            </ul>
          </Card>

          {article.sources.length > 0 && (
            <section className="space-y-3" aria-labelledby="sources-heading">
              <h2 id="sources-heading" className="text-xl font-semibold text-deep-plum">Sources</h2>
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
            <p className="text-sm text-gray-700">Reviewed by {article.reviewed_by}</p>
          )}

          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
            This is education, not a diagnosis.
          </p>
        </>
      )}
    </PageShell>
  );
}