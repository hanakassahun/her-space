"use client";

import { FormEvent, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import LikeButton from "@/components/LikeButton";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import Input from "@/components/ui/Input";
import BookmarkButton from "@/components/ui/BookmarkButton";
import UserText from "@/components/UserText";
import { useLanguage } from "@/components/LanguageProvider";

type PostType = "experience" | "question" | "knowledge";
type Professional = { title: string } | { title: string }[] | null;
type PostProfile = {
  display_name: string | null;
  verified_professionals: Professional;
};

type Post = {
  id: string;
  author_id: string;
  type: PostType;
  provenance: "personal" | "community" | "evidence";
  sources: string[];
  title: string;
  body: string;
  topics: string[];
  sensitive: boolean;
  created_at: string;
  profiles: PostProfile | PostProfile[] | null;
};

type RelatedArticle = {
  slug: string;
  title: string;
  title_am: string | null;
  summary: string;
  summary_am: string | null;
  topics: string[];
};

type Comment = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

const typeVariants: Record<PostType, "rose" | "sky" | "mint"> = {
  experience: "rose",
  question: "sky",
  knowledge: "mint",
};

const typeTranslationKeys = {
  experience: "postType.experience",
  question: "postType.question",
  knowledge: "postType.knowledge",
} as const;

function getAuthorName(profiles: Post["profiles"] | Comment["profiles"]) {
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  return profile?.display_name || "Her Space member";
}

function getProfessionalTitle(profiles: Post["profiles"]) {
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  const professional = profile?.verified_professionals;
  return (Array.isArray(professional) ? professional[0] : professional)?.title;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

  function getReadingMinutes(body: string) {
    const count = /[\u1200-\u137F]/.test(body)
      ? body.replace(/\s/g, "").length / 900
      : body.trim().split(/\s+/).filter(Boolean).length / 200;
    return Math.max(1, Math.ceil(count));
  }

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [relatedArticle, setRelatedArticle] = useState<RelatedArticle | null>(null);
  const [revealedPostId, setRevealedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editTopics, setEditTopics] = useState("");
  const [editSources, setEditSources] = useState("");
  const [savingPost, setSavingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [activeReportTarget, setActiveReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportFeedback, setReportFeedback] = useState<Record<string, string>>({});
  const [submittingReport, setSubmittingReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookmarking, setBookmarking] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [message, setMessage] = useState("");
  const likeRequest = useRef(false);
  const bookmarkRequest = useRef(false);

  async function loadComments(postId: string) {
    const { data, error } = await supabase
      .from("comments")
      .select("id, author_id, body, created_at, profiles!comments_author_id_fkey(display_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(friendlyError(error, t));
      return;
    }

    setComments((data ?? []) as Comment[]);
  }

  useEffect(() => {
    async function loadPost() {
      setRelatedArticle(null);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      setUserId(authData.user.id);

      const [postResult, bookmarkResult, likesResult] = await Promise.all([
        supabase
          .from("posts")
          .select("id, author_id, type, provenance, sources, title, body, topics, sensitive, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))")
          .eq("id", id)
          .single(),
        supabase
          .from("bookmarks")
          .select("post_id")
          .eq("user_id", authData.user.id)
          .eq("post_id", id)
          .maybeSingle(),
        supabase.from("likes").select("user_id").eq("post_id", id),
      ]);

      if (postResult.error) {
        setMessage(friendlyError(postResult.error, t));
      } else {
        const loadedPost = postResult.data as Post;
        setPost(loadedPost);
        if (loadedPost.topics?.length) {
          const overlapTerms = [...new Set(loadedPost.topics.flatMap((topic) => [topic, topic.toLowerCase(), topic.toUpperCase()]))];
          const { data: articleCandidates } = await supabase
            .from("articles")
            .select("slug, title, title_am, summary, summary_am, topics")
            .eq("published", true)
            .overlaps("topics", overlapTerms)
            .limit(8);
          const postTopics = new Set(loadedPost.topics.map((topic) => topic.toLowerCase()));
          const match = (articleCandidates ?? []).find((article) =>
            ((article.topics ?? []) as string[]).some((topic) => postTopics.has(topic.toLowerCase()))
          );
          setRelatedArticle(match ? match as RelatedArticle : null);
        } else {
          setRelatedArticle(null);
        }
      }

      if (bookmarkResult.error) {
        setMessage(friendlyError(bookmarkResult.error, t));
      } else {
        setSaved(Boolean(bookmarkResult.data));
      }

      if (likesResult.error) {
        setMessage(friendlyError(likesResult.error, t));
      } else {
        setLikeCount(likesResult.data.length);
        setLiked(likesResult.data.some((like) => like.user_id === authData.user.id));
      }

      if (!postResult.error) {
        await loadComments(id);
      }

      setLoading(false);
    }

    void loadPost();
  }, [id, router]);

  async function toggleBookmark() {
    if (!userId || bookmarkRequest.current) return;

    bookmarkRequest.current = true;
    setBookmarking(true);
    setMessage("");
    const previousSaved = saved;
    setSaved(!previousSaved);
    try {
      const result = previousSaved
        ? await supabase
            .from("bookmarks")
            .delete()
            .eq("user_id", userId)
            .eq("post_id", id)
        : await supabase.from("bookmarks").insert({ post_id: id });
      if (result.error) throw result.error;
    } catch (error) {
      setSaved(previousSaved);
      const friendlyMessage = friendlyError(error, t);
      setMessage(friendlyMessage);
      window.setTimeout(() => setMessage((currentMessage) => currentMessage === friendlyMessage ? "" : currentMessage), 3000);
    } finally {
      bookmarkRequest.current = false;
      setBookmarking(false);
    }
  }

  async function toggleLike() {
    if (!userId || likeRequest.current) return;
    likeRequest.current = true;
    const previousLiked = liked;
    const previousCount = likeCount;
    setLiked(!previousLiked);
    setLikeCount(previousCount + (previousLiked ? -1 : 1));
    try {
      const result = previousLiked
        ? await supabase.from("likes").delete().eq("user_id", userId).eq("post_id", id)
        : await supabase.from("likes").insert({ post_id: id });
      if (result.error) throw result.error;
    } catch (error) {
      setLiked(previousLiked);
      setLikeCount(previousCount);
      const friendlyMessage = friendlyError(error, t);
      setMessage(friendlyMessage);
      window.setTimeout(() => setMessage((currentMessage) => currentMessage === friendlyMessage ? "" : currentMessage), 3000);
    } finally {
      likeRequest.current = false;
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || submittingComment || !commentBody.trim()) return;

    setSubmittingComment(true);
    setMessage("");
    const { error } = await supabase.from("comments").insert({
      post_id: id,
      body: commentBody.trim(),
    });

    if (error) {
      setMessage(friendlyError(error, t));
    } else {
      setCommentBody("");
      await loadComments(id);
    }
    setSubmittingComment(false);
  }

  function beginPostEdit() {
    if (!post) return;
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditTopics(post.topics.join(", "));
    setEditSources(post.sources.join("\n"));
    setEditingPost(true);
    setMessage("");
  }

  async function savePostEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post || post.author_id !== userId || savingPost) return;

    const sources = editSources.split("\n").map((source) => source.trim()).filter(Boolean);
    if (post.provenance === "evidence" && sources.length === 0) {
      setMessage(t("post.evidenceNeedsSource"));
      return;
    }

    setSavingPost(true);
    setMessage("");
    const { data, error } = await supabase
      .from("posts")
      .update({
        title: editTitle.trim(),
        body: editBody.trim(),
        topics: editTopics.split(/[,،፣]/).map((topic) => topic.trim()).filter(Boolean),
        ...(post.provenance === "evidence" ? { sources } : {}),
      })
      .eq("id", post.id)
      .select("id, author_id, type, provenance, sources, title, body, topics, sensitive, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))")
      .single();

    if (error) {
      setMessage(friendlyError(error, t));
    } else {
      setPost(data as Post);
      setEditingPost(false);
    }
    setSavingPost(false);
  }

  async function deletePost() {
    if (!post || post.author_id !== userId || deletingPost) return;
    if (!window.confirm(t("post.deleteConfirm"))) return;

    setDeletingPost(true);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      setMessage(friendlyError(error, t));
      setDeletingPost(false);
      return;
    }
    router.push("/feed");
  }

  async function deleteComment(comment: Comment) {
    if (comment.author_id !== userId || deletingCommentId) return;
    if (!window.confirm(t("post.deleteCommentConfirm"))) return;

    setDeletingCommentId(comment.id);
    const { error } = await supabase.from("comments").delete().eq("id", comment.id);
    if (error) {
      setMessage(friendlyError(error, t));
      setDeletingCommentId(null);
      return;
    }
    setComments((current) => current.filter((item) => item.id !== comment.id));
    setDeletingCommentId(null);
  }

  async function handleReportSubmit(
    event: FormEvent<HTMLFormElement>,
    target: "post" | "comment",
    targetId: string
  ) {
    event.preventDefault();
    const reason = reportReason.trim();
    if (!reason || submittingReport) return;

    setSubmittingReport(true);
    setMessage("");
    const { error } = await supabase.from("reports").insert({
      reason,
      ...(target === "post" ? { post_id: targetId } : { comment_id: targetId }),
    });

    if (error) {
      setMessage(friendlyError(error, t));
    } else {
      setReportFeedback((current) => ({ ...current, [targetId]: t("post.reportThanks") }));
      setReportReason("");
      setActiveReportTarget(null);
    }
    setSubmittingReport(false);
  }

  function renderReportControl(target: "post" | "comment", targetId: string) {
    const reportKey = `${target}:${targetId}`;
    return (
      <div className="space-y-2">
        {reportFeedback[targetId] ? (
          <p className="text-sm text-rose-800">{reportFeedback[targetId]}</p>
        ) : activeReportTarget === reportKey ? (
          <form
            className="space-y-2"
            onSubmit={(event) => handleReportSubmit(event, target, targetId)}
          >
            <Textarea
              className="min-h-20 text-sm"
              placeholder="Reason for reporting"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              maxLength={500}
              required
            />
            <div className="flex gap-3">
              <Button
                className="text-sm"
                type="submit"
                disabled={submittingReport || !reportReason.trim()}
              >
                {submittingReport ? t("post.submittingReport") : t("post.submitReport")}
              </Button>
              <Button
                variant="ghost"
                className="text-sm"
                type="button"
                onClick={() => setActiveReportTarget(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="ghost"
            className="text-sm"
            type="button"
            onClick={() => {
              setReportReason("");
              setActiveReportTarget(reportKey);
            }}
          >
            {t("post.report")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <PageShell className="max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
        {loading && <p className="text-gray-700">{t("post.loading")}</p>}
        {message && <Card className="text-red-700">{message}</Card>}

        {post && (
          <>
            <Card as="article" className="post-card space-y-5">
              {editingPost ? (
                <form className="space-y-4" onSubmit={savePostEdit}>
                  <label className="block space-y-2 text-sm font-medium text-deep-plum">
                    {t("common.title")}
                    <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
                  </label>
                  <label className="block space-y-2 text-sm font-medium text-deep-plum">
                    {t("common.body")}
                    <Textarea className="min-h-40" value={editBody} onChange={(event) => setEditBody(event.target.value)} required />
                  </label>
                  <label className="block space-y-2 text-sm font-medium text-deep-plum">
                    {t("post.topicsInput")}
                    <Input value={editTopics} onChange={(event) => setEditTopics(event.target.value)} />
                  </label>
                  {post.provenance === "evidence" && (
                    <label className="block space-y-2 text-sm font-medium text-deep-plum">
                      {t("post.sources")}
                      <Textarea className="min-h-24" value={editSources} onChange={(event) => setEditSources(event.target.value)} required />
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={savingPost}>{savingPost ? t("post.saving") : t("post.saveChanges")}</Button>
                    <Button variant="secondary" type="button" onClick={() => setEditingPost(false)}>{t("common.cancel")}</Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <h1 className="break-words text-2xl font-bold text-gray-900">{post.title}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={typeVariants[post.type]}>{t(typeTranslationKeys[post.type])}</Badge>
                    <ProvenanceBadge provenance={post.provenance} sources={post.sources} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-600">
                    <span className="gradient-aurora flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" aria-hidden="true">
                      {getAuthorName(post.profiles).trim().charAt(0).toLocaleUpperCase() || "H"}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <Link className="font-medium text-deep-plum underline" href={`/u/${post.author_id}`}>
                        {getAuthorName(post.profiles)}
                      </Link>
                      {getProfessionalTitle(post.profiles) && (
                        <span className="rounded bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">
                          {t("common.verifiedProfessional")} {getProfessionalTitle(post.profiles)}
                        </span>
                      )}
                      <time className="text-gray-500" dateTime={post.created_at}>{formatDate(post.created_at)}</time>
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{getReadingMinutes(post.body)} {t("read.minRead")}</p>

                  {post.sensitive && revealedPostId !== post.id ? (
                    <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4" role="note">
                      <p className="text-sm text-rose-950">{t("read.sensitiveWarning")}</p>
                      <Button variant="secondary" type="button" onClick={() => setRevealedPostId(post.id)}>
                        {t("read.showPost")}
                      </Button>
                    </div>
                  ) : (
                    <>
                      {post.topics?.length > 0 && (
                        <ul className="flex flex-wrap gap-2" aria-label={t("common.topics")}>
                          {post.topics.map((topic, index) => (
                            <li key={`${topic}-${index}`}><Badge variant="lilac">{topic}</Badge></li>
                          ))}
                        </ul>
                      )}
                      <UserText text={post.body} className="max-w-[65ch] text-[17px] text-gray-800" />
                    </>
                  )}

                  {post.author_id === userId && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" className="text-sm" type="button" onClick={beginPostEdit}>{t("common.edit")}</Button>
                      <Button variant="ghost" className="text-sm text-red-800" type="button" disabled={deletingPost} onClick={deletePost}>
                        {deletingPost ? t("post.deleting") : t("common.delete")}
                      </Button>
                    </div>
                  )}
                  {renderReportControl("post", id)}
                </div>
              )}
            </Card>

            {relatedArticle && (
              <Link href={`/learn/${relatedArticle.slug}`} className="block">
                <Card className="space-y-1 border border-soft-lilac/70 bg-white/75 transition hover:bg-white">
                  <p className="text-xs font-medium text-gray-600">{t("read.relatedArticle")}</p>
                  <h2 className="break-words font-semibold text-deep-plum">
                    {lang === "am" && relatedArticle.title_am?.trim() ? relatedArticle.title_am : relatedArticle.title}
                  </h2>
                </Card>
              </Link>
            )}

            <section className="space-y-4" aria-labelledby="comments-heading">
              <h2 id="comments-heading" className="text-xl font-semibold text-deep-plum">
                {t("post.comments")}
              </h2>

              {comments.length === 0 ? (
                <Card className="text-gray-700">{t("post.noComments")}</Card>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <Card as="article" key={comment.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                          {getAuthorName(comment.profiles)}
                          {comment.author_id === post.author_id && <Badge variant="sky">{t("read.author")}</Badge>}
                        </p>
                        <time className="text-xs text-gray-500" dateTime={comment.created_at}>
                          {formatDate(comment.created_at)}
                        </time>
                      </div>
                      <UserText text={comment.body} className="text-gray-800" />
                      {comment.author_id === userId && (
                        <Button
                          variant="ghost"
                          className="text-sm text-red-800"
                          type="button"
                          disabled={deletingCommentId === comment.id}
                          onClick={() => deleteComment(comment)}
                        >
                          {deletingCommentId === comment.id ? t("post.deleting") : t("common.delete")}
                        </Button>
                      )}
                      {renderReportControl("comment", comment.id)}
                    </Card>
                  ))}
                </div>
              )}

              <Card as="div" className="space-y-3">
              <form id="comment-form" className="space-y-3" onSubmit={handleCommentSubmit}>
                <label className="block space-y-2 text-sm font-medium text-gray-900">
                  {t("post.addComment")}
                  <Textarea
                    className="min-h-28"
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    maxLength={2000}
                    required
                  />
                </label>
                <Button
                  type="submit"
                  disabled={submittingComment || !commentBody.trim()}
                >
                  {submittingComment ? t("post.commenting") : t("post.comment")}
                </Button>
              </form>
              </Card>
            </section>
          </>
        )}
        {post && !editingPost && (
          <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 border-t border-soft-lilac/70 bg-pearl-white/95 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-lg backdrop-blur md:bottom-0 md:px-6 md:pb-2">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <LikeButton count={likeCount} liked={liked} onToggle={toggleLike} />
              <Button
                variant="secondary"
                type="button"
                className="min-w-11 gap-2"
                onClick={() => document.getElementById("comment-form")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" />
                </svg>
                <span>{t("read.jumpToComments")}</span>
              </Button>
              <BookmarkButton
                saved={saved}
                disabled={bookmarking}
                saveLabel={t("post.savePost")}
                savedLabel={t("post.removeSaved")}
                onToggle={() => void toggleBookmark()}
                variant={saved ? "primary" : "secondary"}
              />
            </div>
          </div>
        )}
    </PageShell>
  );
}