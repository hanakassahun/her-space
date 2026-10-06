"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/components/LanguageProvider";

type ArticleCategory = "health" | "body_beauty" | "mind_life" | "life_stages";

type Article = {
  id: string;
  slug: string;
  title: string;
  title_am: string | null;
  summary: string;
  summary_am: string | null;
  category: ArticleCategory;
  topics: string[];
};

const categoryLabels: Record<ArticleCategory, string> = {
  health: "Health",
  body_beauty: "Body & Beauty",
  mind_life: "Mind & Life",
  life_stages: "Life stages",
};

const categoryTranslationKeys = {
  health: "explore.health",
  body_beauty: "explore.bodyBeauty",
  mind_life: "explore.mindLife",
  life_stages: "explore.lifeStages",
} as const;

const categories: ArticleCategory[] = ["health", "body_beauty", "mind_life", "life_stages"];

export default function LearnPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory | "all">("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadArticles() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("articles")
        .select("id, slug, title, title_am, summary, summary_am, category, topics")
        .eq("published", true)
        .order("category", { ascending: true })
        .order("title", { ascending: true });

      if (error) setMessage(error.message);
      else setArticles((data ?? []) as Article[]);
      setLoading(false);
    }

    void loadArticles();
  }, [router]);

  const filteredArticles = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return articles.filter((article) => {
      const matchesCategory = selectedCategory === "all" || article.category === selectedCategory;
      const matchesSearch =
        !term ||
        article.title.toLocaleLowerCase().includes(term) ||
        article.summary.toLocaleLowerCase().includes(term) ||
        article.topics.some((topic) => topic.toLocaleLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [articles, search, selectedCategory]);

  return (
    <PageShell className="max-w-3xl space-y-7 px-4 py-6 md:px-6 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-deep-plum">{t("learn.title")}</h1>
          <p className="mt-1 text-sm text-gray-700">{t("learn.intro")}</p>
        </div>
      </header>

      <Input
        type="search"
        aria-label={t("learn.searchLabel")}
        placeholder={t("learn.search")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <nav className="flex flex-wrap gap-2" aria-label="Filter articles by category">
        <Button
          variant={selectedCategory === "all" ? "primary" : "secondary"}
          className="text-sm"
          type="button"
          aria-pressed={selectedCategory === "all"}
          onClick={() => setSelectedCategory("all")}
        >
            {t("learn.all")}
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "primary" : "secondary"}
            className="text-sm"
            type="button"
            aria-pressed={selectedCategory === category}
            onClick={() => setSelectedCategory(category)}
          >
            {t(categoryTranslationKeys[category])}
          </Button>
        ))}
      </nav>

      {loading && <p className="text-gray-700">{t("learn.loading")}</p>}
      {message && <Card className="text-red-700">{message}</Card>}
      {!loading && !message && filteredArticles.length === 0 && (
        <Card className="text-gray-700">{t("learn.noResults")}</Card>
      )}

      {!loading && !message && categories.map((category) => {
        const categoryArticles = filteredArticles.filter((article) => article.category === category);
        if (!categoryArticles.length) return null;
        return (
          <section className="space-y-3" key={category} aria-labelledby={`category-${category}`}>
            <h2 id={`category-${category}`} className="text-xl font-semibold text-deep-plum">
              {t(categoryTranslationKeys[category])}
            </h2>
            {categoryArticles.map((article) => (
              <Card as="article" key={article.id} className="space-y-3">
                <Badge variant="lilac">{t(categoryTranslationKeys[article.category])}</Badge>
                <div>
                  <h3 className="text-lg font-semibold text-deep-plum">
                    <Link href={`/learn/${article.slug}`}>{lang === "am" && article.title_am?.trim() ? article.title_am : article.title}</Link>
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-700">{lang === "am" && article.summary_am?.trim() ? article.summary_am : article.summary}</p>
                </div>
                {lang === "am" && (!article.title_am?.trim() || !article.summary_am?.trim()) && (
                  <p className="text-xs text-gray-600">{t("learn.notTranslated")}</p>
                )}
                {article.topics.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label={t("learn.articleTopics")}>
                    {article.topics.map((topic) => (
                      <li key={topic}>
                        <Badge variant="sky">{topic}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </section>
        );
      })}
    </PageShell>
  );
}