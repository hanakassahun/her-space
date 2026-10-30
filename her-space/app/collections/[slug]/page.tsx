"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";

type Collection = {
  id: string;
  title: string;
  title_am: string | null;
  description: string | null;
  description_am: string | null;
};

type Related<T> = T | T[] | null;

type ArticleItem = {
  id: string;
  slug: string;
  title: string;
  title_am: string | null;
  summary: string | null;
  summary_am: string | null;
  category: string;
};

type PostItem = {
  id: string;
  title: string;
  type: "experience" | "question" | "knowledge";
  provenance: "personal" | "community" | "evidence";
  profiles: Related<{ display_name: string | null }>;
};

type CollectionItem = {
  id: string;
  position: number;
  articles: Related<ArticleItem>;
  posts: Related<PostItem>;
};

function first<T>(related: Related<T>): T | null {
  return Array.isArray(related) ? related[0] ?? null : related;
}

export default function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { lang, t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCollection() {
      if (authLoading) return;
      if (!userId) {
        router.replace("/login");
        return;
      }

      const { data: collectionData, error: collectionError } = await supabase
        .from("collections")
        .select("id, slug, title, title_am, description, description_am")
        .eq("slug", slug)
        .maybeSingle();

      if (!active) return;
      if (collectionError) {
        setMessage(friendlyError(collectionError, t));
        setLoading(false);
        return;
      }
      if (!collectionData) {
        setCollection(null);
        setLoading(false);
        return;
      }

      setCollection(collectionData as Collection);
      const { data: itemData, error: itemError } = await supabase
        .from("collection_items")
        .select("id, position, articles!collection_items_article_id_fkey(id, slug, title, title_am, summary, summary_am, category), posts!collection_items_post_id_fkey(id, title, type, provenance, profiles!posts_author_id_fkey(display_name))")
        .eq("collection_id", collectionData.id)
        .order("position", { ascending: true });

      if (!active) return;
      if (itemError) setMessage(friendlyError(itemError, t));
      else {
        setItems(((itemData ?? []) as CollectionItem[]).filter((item) => first(item.articles) || first(item.posts)));
      }
      setLoading(false);
    }

    void loadCollection();
    return () => {
      active = false;
    };
  }, [authLoading, router, slug, t, userId]);

  const collectionTitle = collection
    ? lang === "am" && collection.title_am?.trim()
      ? collection.title_am
      : collection.title
    : "";
  const collectionDescription = collection
    ? lang === "am" && collection.description_am?.trim()
      ? collection.description_am
      : collection.description
    : "";

  return (
    <PageShell className="max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      {loading && <p className="text-gray-700">{t("common.loading")}</p>}
      {message && <Card className="text-red-700"><FriendlyErrorMessage message={message} /></Card>}
      {!loading && !message && !collection && (
        <Card className="space-y-4">
          <p className="break-words text-gray-700">{t("collections.notFound")}</p>
          <Link
            href="/learn"
            className="inline-flex min-h-11 items-center rounded-full border border-[#CDBDEB] bg-white px-4 py-2 font-semibold text-deep-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
          >
            {t("learn.title")}
          </Link>
        </Card>
      )}
      {!loading && collection && (
        <>
          <header className="space-y-2">
            <h1 className="break-words text-3xl font-bold text-deep-plum">{collectionTitle}</h1>
            {collectionDescription && (
              <p className="break-words whitespace-pre-wrap leading-7 text-gray-700">{collectionDescription}</p>
            )}
          </header>

          {!message && items.length === 0 && (
            <Card className="break-words text-gray-700">{t("collections.itemsEmpty")}</Card>
          )}

          {!message && items.map((item) => {
            const article = first(item.articles);
            if (article) {
              const title = lang === "am" && article.title_am?.trim() ? article.title_am : article.title;
              const summary = lang === "am" && article.summary_am?.trim() ? article.summary_am : article.summary;
              return (
                <Link
                  key={item.id}
                  href={`/learn/${article.slug}`}
                  className="block min-h-11 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
                >
                  <Card as="article" className="space-y-2">
                    <span className="text-xs font-semibold text-gray-600">{t("collections.reviewed")}</span>
                    <h2 className="break-words text-lg font-semibold text-deep-plum">{title}</h2>
                    {summary && <p className="break-words text-sm leading-6 text-gray-700">{summary}</p>}
                  </Card>
                </Link>
              );
            }

            const post = first(item.posts);
            if (!post) return null;
            const profile = first(post.profiles);
            return (
              <Link
                key={item.id}
                href={`/post/${post.id}`}
                className="block min-h-11 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
              >
                <Card as="article" className="space-y-2">
                  <span className="text-xs font-semibold text-gray-600">{t("collections.memberStory")}</span>
                  <h2 className="break-words text-lg font-semibold text-deep-plum">{post.title}</h2>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ProvenanceBadge provenance={post.provenance} short />
                    <span className="break-words text-sm text-gray-600">
                      {profile?.display_name || t("common.herSpaceMember")}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </>
      )}
    </PageShell>
  );
}
