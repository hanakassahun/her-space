"use client";

import { FormEvent, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import LikeButton from "@/components/LikeButton";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import Input from "@/components/ui/Input";
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
  created_at: string;
  profiles: PostProfile | PostProfile[] | null;
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

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
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

  async function loadComments(postId: string) {
    const { data, error } = await supabase
      .from("comments")
      .select("id, author_id, body, created_at, profiles!comments_author_id_fkey(display_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setComments((data ?? []) as Comment[]);
  }

  useEffect(() => {
    async function loadPost() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      setUserId(authData.user.id);

      const [postResult, bookmarkResult, likesResult] = await Promise.all([
        supabase
          .from("posts")
          .select("id, author_id, type, provenance, sources, title, body, topics, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))")
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
        setMessage(postResult.error.message);
      } else {
        setPost(postResult.data as Post);
      }

      if (bookmarkResult.error) {
        setMessage(bookmarkResult.error.message);
      } else {
        setSaved(Boolean(bookmarkResult.data));
      }

      if (likesResult.error) {
        setMessage(likesResult.error.message);
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
    if (!userId || bookmarking) return;

    setBookmarking(true);
    setMessage("");
    const result = saved
      ? await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", userId)
          .eq("post_id", id)
      : await supabase.from("bookmarks").insert({ post_id: id });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setSaved(!saved);
    }
    setBookmarking(false);
  }

  async function toggleLike() {
    if (!userId) return;
    const result = liked
      ? await supabase.from("likes").delete().eq("user_id", userId).eq("post_id", id)
      : await supabase.from("likes").insert({ post_id: id });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setLiked(!liked);
      setLikeCount((count) => count + (liked ? -1 : 1));
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
      setMessage(error.message);
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
        topics: editTopics.split(",").map((topic) => topic.trim()).filter(Boolean),
        ...(post.provenance === "evidence" ? { sources } : {}),
      })
      .eq("id", post.id)
      .select("id, author_id, type, provenance, sources, title, body, topics, created_at, profiles!posts_author_id_fkey(display_name, verified_professionals!verified_professionals_user_id_fkey(title))")
      .single();

    if (error) {
      setMessage(error.message);
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
      setMessage(error.message);
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
      setMessage(error.message);
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
      setMessage(error.message);
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
            <Card as="article" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant={typeVariants[post.type]}>
                  {t(typeTranslationKeys[post.type])}
                </Badge>
                <time className="text-sm text-gray-500" dateTime={post.created_at}>
                  {formatDate(post.created_at)}
                </time>
              </div>

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
                <div className="space-y-3">
                  <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>
                  <p className="whitespace-pre-wrap text-gray-800">{post.body}</p>
                  {post.author_id === userId && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" className="text-sm" type="button" onClick={beginPostEdit}>{t("common.edit")}</Button>
                      <Button variant="ghost" className="text-sm text-red-800" type="button" disabled={deletingPost} onClick={deletePost}>
                        {deletingPost ? t("post.deleting") : t("common.delete")}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <ProvenanceBadge provenance={post.provenance} sources={post.sources} />

              {post.topics?.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label={t("common.topics")}>
                  {post.topics.map((topic, index) => (
                    <li
                      className="rounded-full bg-soft-lilac px-2.5 py-1 text-xs text-deep-plum"
                      key={`${topic}-${index}`}
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose-100 pt-4">
                <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  {t("common.by")} <Link className="underline" href={`/u/${post.author_id}`}>
                    {getAuthorName(post.profiles)}
                  </Link>
                  {getProfessionalTitle(post.profiles) && (
                    <span className="rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                      {t("common.verifiedProfessional")} {getProfessionalTitle(post.profiles)}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  {renderReportControl("post", id)}
                  <LikeButton count={likeCount} liked={liked} onToggle={toggleLike} />
                  <Button
                    variant={saved ? "primary" : "secondary"}
                    className="!h-11 !w-11 !min-w-11 !px-0 !py-0"
                    type="button"
                    onClick={toggleBookmark}
                    disabled={bookmarking}
                    aria-label={t(saved ? "post.removeSaved" : "post.savePost")}
                    title={t(saved ? "post.saved" : "post.save")}
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill={saved ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z" />
                    </svg>
                  </Button>
                </div>
              </div>
            </Card>

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
                        <p className="text-sm font-medium text-gray-900">
                          {getAuthorName(comment.profiles)}
                        </p>
                        <time className="text-xs text-gray-500" dateTime={comment.created_at}>
                          {formatDate(comment.created_at)}
                        </time>
                      </div>
                      <p className="whitespace-pre-wrap text-gray-800">{comment.body}</p>
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
              <form className="space-y-3" onSubmit={handleCommentSubmit}>
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
    </PageShell>
  );
}