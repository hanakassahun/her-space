"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

type Collection = {
  id: string;
  slug: string;
  title: string;
  title_am: string | null;
  description: string | null;
  description_am: string | null;
  audience: "all" | "adult";
  sort_order: number;
  published: boolean;
  created_at: string;
};

type ArticleOption = { id: string; slug: string; title: string };
type Related<T> = T | T[] | null;
type CollectionItem = {
  id: string;
  collection_id: string;
  position: number;
  article_id: string | null;
  post_id: string | null;
  articles: Related<{ title: string; slug: string }>;
  posts: Related<{ title: string }>;
};
type CollectionForm = { title: string; slug: string; description: string };

const emptyForm: CollectionForm = { title: "", slug: "", description: "" };
const postIdPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function first<T>(related: Related<T>): T | null {
  return Array.isArray(related) ? related[0] ?? null : related;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [form, setForm] = useState<CollectionForm>(emptyForm);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [postLink, setPostLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyCollectionId, setBusyCollectionId] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAdminCollections() {
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

      const [collectionResult, articleResult] = await Promise.all([
        supabase
          .from("collections")
          .select("id, slug, title, title_am, description, description_am, audience, sort_order, published, created_at")
          .order("sort_order", { ascending: true }),
        supabase.from("articles").select("id, slug, title").order("title", { ascending: true }),
      ]);

      if (!active) return;
      if (collectionResult.error) setMessage(collectionResult.error.message);
      else setCollections((collectionResult.data ?? []) as Collection[]);
      if (articleResult.error) setMessage(articleResult.error.message);
      else setArticles((articleResult.data ?? []) as ArticleOption[]);
      setLoading(false);
    }

    void loadAdminCollections();
    return () => {
      active = false;
    };
  }, [router]);

  async function loadItems(collectionId: string) {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from("collection_items")
      .select("id, collection_id, position, article_id, post_id, articles!collection_items_article_id_fkey(title, slug), posts!collection_items_post_id_fkey(title)")
      .eq("collection_id", collectionId)
      .order("position", { ascending: true });

    if (error) setMessage(error.message);
    else setItems((data ?? []) as CollectionItem[]);
    setLoadingItems(false);
  }

  function startEditing(collection: Collection) {
    setEditingCollection(collection);
    setForm({
      title: collection.title,
      slug: collection.slug,
      description: collection.description ?? "",
    });
    setItems([]);
    setSelectedArticleId("");
    setPostLink("");
    void loadItems(collection.id);
    setMessage("");
  }

  function clearForm() {
    setEditingCollection(null);
    setForm(emptyForm);
    setItems([]);
    setMessage("");
  }

  async function saveCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !form.title.trim() || !form.slug.trim()) return;

    setSaving(true);
    setMessage("");
    const collectionData = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
    };
    const result = editingCollection
      ? await supabase.from("collections").update(collectionData).eq("id", editingCollection.id)
      : await supabase
          .from("collections")
          .insert({
            ...collectionData,
            title_am: null,
            description_am: null,
            audience: "all",
            sort_order: collections.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1,
            published: false,
          })
          .select("id, slug, title, title_am, description, description_am, audience, sort_order, published, created_at")
          .single();

    if (result.error) {
      setMessage(result.error.message);
      setSaving(false);
      return;
    }

    if (editingCollection) {
      const updated = { ...editingCollection, ...collectionData };
      setCollections((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingCollection(updated);
      setMessage("Collection updated.");
    } else {
      const created = result.data as Collection;
      setCollections((current) => [...current, created].sort((a, b) => a.sort_order - b.sort_order));
      setEditingCollection(created);
      setForm({ title: created.title, slug: created.slug, description: created.description ?? "" });
      setItems([]);
      setMessage("Collection created.");
    }
    setSaving(false);
  }

  async function updateCollection(collection: Collection, changes: Partial<Pick<Collection, "published" | "audience" | "sort_order">>) {
    setBusyCollectionId(collection.id);
    setMessage("");
    const { error } = await supabase.from("collections").update(changes).eq("id", collection.id);
    if (error) setMessage(error.message);
    else {
      setCollections((current) => current.map((item) =>
        item.id === collection.id ? { ...item, ...changes } : item
      ).sort((a, b) => a.sort_order - b.sort_order));
      if (editingCollection?.id === collection.id) {
        setEditingCollection((current) => current ? { ...current, ...changes } : current);
      }
    }
    setBusyCollectionId(null);
  }

  async function deleteCollection(collection: Collection) {
    if (!window.confirm(`Delete "${collection.title}" and its items?`)) return;
    setBusyCollectionId(collection.id);
    setMessage("");
    const { error } = await supabase.from("collections").delete().eq("id", collection.id);
    if (error) setMessage(error.message);
    else {
      setCollections((current) => current.filter((item) => item.id !== collection.id));
      if (editingCollection?.id === collection.id) clearForm();
    }
    setBusyCollectionId(null);
  }

  async function addItem(itemData: { article_id: string } | { post_id: string }) {
    if (!editingCollection) return;
    setMessage("");
    const position = items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    const { error } = await supabase.from("collection_items").insert({
      collection_id: editingCollection.id,
      position,
      ...itemData,
    });
    if (error) setMessage(error.message);
    else await loadItems(editingCollection.id);
  }

  async function addArticle() {
    if (!selectedArticleId) return;
    await addItem({ article_id: selectedArticleId });
    setSelectedArticleId("");
  }

  async function addPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const postId = postLink.match(postIdPattern)?.[0];
    if (!postId) {
      setMessage("Paste a valid post link or UUID.");
      return;
    }
    await addItem({ post_id: postId });
    setPostLink("");
  }

  async function removeItem(item: CollectionItem) {
    if (!editingCollection) return;
    setBusyItemId(item.id);
    setMessage("");
    const { error } = await supabase.from("collection_items").delete().eq("id", item.id);
    if (error) setMessage(error.message);
    else await loadItems(editingCollection.id);
    setBusyItemId(null);
  }

  async function moveItem(item: CollectionItem, direction: -1 | 1) {
    if (!editingCollection || busyItemId) return;
    const index = items.findIndex((current) => current.id === item.id);
    const neighbor = items[index + direction];
    if (!neighbor) return;

    setBusyItemId(item.id);
    setMessage("");
    const temporaryPosition = Math.max(...items.map((current) => current.position), -1) + 1;
    const firstUpdate = await supabase
      .from("collection_items")
      .update({ position: temporaryPosition })
      .eq("id", item.id);
    const secondUpdate = firstUpdate.error
      ? firstUpdate
      : await supabase.from("collection_items").update({ position: item.position }).eq("id", neighbor.id);
    const finalUpdate = secondUpdate.error
      ? secondUpdate
      : await supabase.from("collection_items").update({ position: neighbor.position }).eq("id", item.id);

    if (finalUpdate.error) setMessage(finalUpdate.error.message);
    await loadItems(editingCollection.id);
    setBusyItemId(null);
  }

  return (
    <PageShell className="max-w-4xl space-y-7 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-deep-plum">Manage collections</h1>
        <Link
          className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-4 text-sm font-medium text-deep-plum shadow-sm transition hover:bg-white"
          href="/admin"
        >
          Back to admin
        </Link>
      </header>

      {message && <Card className="break-words text-red-700" role="status">{message}</Card>}

      <Card as="div" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">
          {editingCollection ? "Edit collection" : "Create collection"}
        </h2>
        <form className="space-y-4" onSubmit={saveCollection}>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Title
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({
                ...current,
                title: event.target.value,
                slug: editingCollection ? current.slug : slugify(event.target.value),
              }))}
              required
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Slug
            <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))} required />
          </label>
          <label className="block space-y-2 text-sm font-medium text-deep-plum">
            Description
            <Textarea className="min-h-20" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving || !form.title.trim() || !form.slug.trim()}>
              {saving ? "Saving..." : editingCollection ? "Save changes" : "Create collection"}
            </Button>
            {editingCollection && <Button variant="secondary" type="button" onClick={clearForm}>Cancel edit</Button>}
          </div>
        </form>

        {editingCollection && (
          <div className="space-y-4 border-t border-soft-lilac pt-4">
            <h3 className="text-lg font-semibold text-deep-plum">Collection items</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1 space-y-2 text-sm font-medium text-deep-plum">
                Add article
                <select
                  className="min-h-11 w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-2.5 text-deep-plum focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8]"
                  value={selectedArticleId}
                  onChange={(event) => setSelectedArticleId(event.target.value)}
                >
                  <option value="">Select an article</option>
                  {articles.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}
                </select>
              </label>
              <Button type="button" variant="secondary" disabled={!selectedArticleId} onClick={() => void addArticle()}>Add article</Button>
            </div>
            <form className="flex flex-wrap items-end gap-3" onSubmit={addPost}>
              <label className="min-w-0 flex-1 space-y-2 text-sm font-medium text-deep-plum">
                Add post link or ID
                <Input value={postLink} onChange={(event) => setPostLink(event.target.value)} placeholder="Paste a post URL or UUID" />
              </label>
              <Button type="submit" variant="secondary" disabled={!postLink.trim()}>Add post</Button>
            </form>
            {loadingItems && <p className="text-sm text-gray-600">Loading items...</p>}
            {!loadingItems && items.length === 0 && <p className="text-sm text-gray-600">No items yet.</p>}
            <ol className="space-y-2">
              {items.map((item, index) => {
                const article = first(item.articles);
                const post = first(item.posts);
                return (
                  <li key={item.id}>
                    <Card as="div" className="flex flex-wrap items-center justify-between gap-3 !p-3">
                      <span className="min-w-0 flex-1 break-words text-sm text-deep-plum">
                        {article ? `Article: ${article.title}` : post ? `Post: ${post.title}` : `Hidden item (${item.id})`}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <Button variant="secondary" type="button" className="!min-h-11 !px-3" disabled={index === 0 || busyItemId !== null} onClick={() => void moveItem(item, -1)} aria-label="Move item up">↑</Button>
                        <Button variant="secondary" type="button" className="!min-h-11 !px-3" disabled={index === items.length - 1 || busyItemId !== null} onClick={() => void moveItem(item, 1)} aria-label="Move item down">↓</Button>
                        <Button variant="ghost" type="button" className="!min-h-11 !px-3 text-red-800" disabled={busyItemId === item.id} onClick={() => void removeItem(item)}>Remove</Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Card>

      <section className="space-y-4" aria-label="Collections">
        <h2 className="text-xl font-semibold text-deep-plum">Collections</h2>
        {loading && <p className="text-gray-700">Loading collections...</p>}
        {!loading && collections.length === 0 && <Card className="text-gray-700">No collections yet.</Card>}
        {collections.map((collection) => (
          <Card as="article" key={collection.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-lg font-semibold text-deep-plum">{collection.title}</h3>
                <p className="break-words text-sm text-gray-600">/{collection.slug}</p>
              </div>
              <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-deep-plum">
                Published
                <button
                  className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle ${collection.published ? "gradient-aurora border-transparent" : "border-[#CDBDEB] bg-soft-lilac/40"}`}
                  type="button"
                  role="switch"
                  aria-checked={collection.published}
                  disabled={busyCollectionId === collection.id}
                  onClick={() => void updateCollection(collection, { published: !collection.published })}
                >
                  <span className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${collection.published ? "translate-x-7" : "translate-x-0"}`} />
                </button>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-deep-plum">
                Audience
                <select
                  className="min-h-11 w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-2.5 text-deep-plum focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8]"
                  value={collection.audience}
                  disabled={busyCollectionId === collection.id}
                  onChange={(event) => void updateCollection(collection, { audience: event.target.value as Collection["audience"] })}
                >
                  <option value="all">All ages</option>
                  <option value="adult">Adults (18+)</option>
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium text-deep-plum">
                Sort order
                <Input
                  type="number"
                  key={`${collection.id}-${collection.sort_order}`}
                  defaultValue={collection.sort_order}
                  disabled={busyCollectionId === collection.id}
                  onBlur={(event) => {
                    const sortOrder = Number(event.currentTarget.value);
                    if (Number.isInteger(sortOrder) && sortOrder !== collection.sort_order) {
                      void updateCollection(collection, { sort_order: sortOrder });
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" type="button" onClick={() => startEditing(collection)}>Edit</Button>
              <Button variant="ghost" className="text-red-800" type="button" disabled={busyCollectionId === collection.id} onClick={() => void deleteCollection(collection)}>Delete</Button>
            </div>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}
