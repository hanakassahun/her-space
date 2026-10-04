"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

type ArticleCategory = "health" | "body_beauty" | "mind_life" | "life_stages";

type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: ArticleCategory;
  topics: string[];
  normal: string;
  needs_attention: string;
  see_doctor: string;
  doctor_questions: string[];
  sources: string[];
  reviewed_by: string | null;
  published: boolean;
};

type ArticleForm = {
  slug: string;
  title: string;
  summary: string;
  category: ArticleCategory;
  topics: string;
  normal: string;
  needsAttention: string;
  seeDoctor: string;
  doctorQuestions: string;
  sources: string;
  reviewedBy: string;
};

const emptyForm: ArticleForm = {
  slug: "",
  title: "",
  summary: "",
  category: "health",
  topics: "",
  normal: "",
  needsAttention: "",
  seeDoctor: "",
  doctorQuestions: "",
  sources: "",
  reviewedBy: "",
};

const categoryLabels: Record<ArticleCategory, string> = {
  health: "Health",
  body_beauty: "Body & Beauty",
  mind_life: "Mind & Life",
  life_stages: "Life stages",
};

const categories: ArticleCategory[] = ["health", "body_beauty", "mind_life", "life_stages"];

function toLines(value: string[]) {
  return value.join("\n");
}

function fromLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function formFromArticle(article: Article): ArticleForm {
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: article.category,
    topics: article.topics.join(", "),
    normal: article.normal,
    needsAttention: article.needs_attention,
    seeDoctor: article.see_doctor,
    doctorQuestions: toLines(article.doctor_questions),
    sources: toLines(article.sources),
    reviewedBy: article.reviewed_by ?? "",
  };
}

function fetchArticles() {
  return supabase
    .from("articles")
    .select("id, slug, title, summary, category, topics, normal, needs_attention, see_doctor, doctor_questions, sources, reviewed_by, published")
    .order("updated_at", { ascending: false });
}

export default function AdminArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadAdminArticles() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (adminError || !admin) {
        router.replace("/");
        return;
      }

      const { data, error } = await fetchArticles();
      if (error) setMessage(error.message);
      else setArticles((data ?? []) as Article[]);
      setLoading(false);
    }

    void loadAdminArticles();
  }, [router]);

  function startEditing(article: Article) {
    setEditingId(article.id);
    setForm(formFromArticle(article));
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setMessage("");
    const articleData = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      summary: form.summary.trim(),
      category: form.category,
      topics: form.topics.split(",").map((topic) => topic.trim()).filter(Boolean),
      normal: form.normal.trim(),
      needs_attention: form.needsAttention.trim(),
      see_doctor: form.seeDoctor.trim(),
      doctor_questions: fromLines(form.doctorQuestions),
      sources: fromLines(form.sources),
      reviewed_by: form.reviewedBy.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from("articles").update(articleData).eq("id", editingId)
      : await supabase.from("articles").insert(articleData);

    if (result.error) {
      setMessage(result.error.message);
      setSaving(false);
      return;
    }

    const { data, error } = await fetchArticles();
    if (error) setMessage(error.message);
    else {
      setArticles((data ?? []) as Article[]);
      clearForm();
      setMessage(editingId ? "Article updated." : "Article created as a draft.");
    }
    setSaving(false);
  }

  async function togglePublished(article: Article) {
    setBusyId(article.id);
    setMessage("");
    const { error } = await supabase
      .from("articles")
      .update({ published: !article.published, updated_at: new Date().toISOString() })
      .eq("id", article.id);

    if (error) setMessage(error.message);
    else setArticles((current) => current.map((item) =>
      item.id === article.id ? { ...item, published: !article.published } : item
    ));
    setBusyId(null);
  }

  async function deleteArticle(article: Article) {
    if (!window.confirm(`Delete “${article.title}”?`)) return;
    setBusyId(article.id);
    setMessage("");
    const { error } = await supabase.from("articles").delete().eq("id", article.id);

    if (error) setMessage(error.message);
    else {
      setArticles((current) => current.filter((item) => item.id !== article.id));
      if (editingId === article.id) clearForm();
    }
    setBusyId(null);
  }

  return (
    <PageShell className="max-w-4xl space-y-7 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-deep-plum">Manage articles</h1>
      </header>

      <Card as="div" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">
          {editingId ? "Edit article" : "Create article"}
        </h2>
        <form className="space-y-4" onSubmit={saveArticle}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Slug
              <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
            </label>
            <label className="block space-y-2 text-sm font-medium text-deep-plum">
              Category
              <select
                className="min-h-11 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 text-deep-plum focus:outline-none focus:ring-2 focus:ring-soft-lilac"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value as ArticleCategory })}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{categoryLabels[category]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Title
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Summary
            <Textarea className="min-h-20" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Topics (comma-separated)
            <Input value={form.topics} onChange={(event) => setForm({ ...form, topics: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            What can be normal
            <Textarea className="min-h-28" value={form.normal} onChange={(event) => setForm({ ...form, normal: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            What may deserve attention
            <Textarea className="min-h-28" value={form.needsAttention} onChange={(event) => setForm({ ...form, needsAttention: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            When to see a doctor
            <Textarea className="min-h-28" value={form.seeDoctor} onChange={(event) => setForm({ ...form, seeDoctor: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Questions to ask your doctor (one per line)
            <Textarea className="min-h-24" value={form.doctorQuestions} onChange={(event) => setForm({ ...form, doctorQuestions: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Sources (one URL per line)
            <Textarea className="min-h-24" value={form.sources} onChange={(event) => setForm({ ...form, sources: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Reviewed by
            <Input value={form.reviewedBy} onChange={(event) => setForm({ ...form, reviewedBy: event.target.value })} />
          </label>
          {message && <p className="text-sm text-deep-plum" role="status">{message}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Create draft"}
            </Button>
            {editingId && <Button variant="secondary" type="button" onClick={clearForm}>Cancel edit</Button>}
          </div>
        </form>
      </Card>

      <section className="space-y-4" aria-label="Articles">
        <h2 className="text-xl font-semibold text-deep-plum">Articles</h2>
        {loading && <p className="text-gray-700">Loading articles...</p>}
        {!loading && articles.length === 0 && <Card className="text-gray-700">No articles yet.</Card>}
        {articles.map((article) => (
          <Card as="article" key={article.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-deep-plum">{article.title}</h3>
                <p className="text-sm text-gray-600">/{article.slug}</p>
              </div>
              <Badge variant={article.published ? "mint" : "sky"}>
                {article.published ? "Published" : "Draft"}
              </Badge>
            </div>
            <p className="text-sm text-gray-700">{categoryLabels[article.category]}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="text-sm" type="button" onClick={() => startEditing(article)}>
                Edit
              </Button>
              <Button
                className="text-sm"
                type="button"
                disabled={busyId === article.id}
                onClick={() => togglePublished(article)}
              >
                {article.published ? "Unpublish" : "Publish"}
              </Button>
              <Button
                variant="ghost"
                className="text-sm text-red-800"
                type="button"
                disabled={busyId === article.id}
                onClick={() => deleteArticle(article)}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}