"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import SuccessCheck from "@/components/ui/SuccessCheck";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/components/AuthProvider";

type Kind = "bug" | "confusing" | "idea" | "other";

const KINDS: { value: Kind; labelKey: "feedback.kindBug" | "feedback.kindConfusing" | "feedback.kindIdea" | "feedback.kindOther" }[] = [
  { value: "bug", labelKey: "feedback.kindBug" },
  { value: "confusing", labelKey: "feedback.kindConfusing" },
  { value: "idea", labelKey: "feedback.kindIdea" },
  { value: "other", labelKey: "feedback.kindOther" },
];

export default function FeedbackPage() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [kind, setKind] = useState<Kind>("idea");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, router, user]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 5 || sending) return;

    // Compute page from referrer
    let page: string | null = null;
    try {
      if (typeof document !== "undefined" && document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin) {
          page = ref.pathname.slice(0, 200);
        }
      }
    } catch {
      // ignore
    }

    setSending(true);
    setError("");
    const { error: dbError } = await supabase.from("feedback").insert({
      kind,
      message: trimmed,
      page,
    });

    if (dbError) {
      setError(friendlyError(dbError, t));
      setSending(false);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <PageShell className="max-w-xl px-4 py-10 md:px-6">
        <Card className="flex flex-col items-center gap-5 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <SuccessCheck />
          </span>
          <p className="text-lg font-semibold text-deep-plum">{t("feedback.thanks")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setMessage("");
                setSent(false);
              }}
            >
              {t("feedback.sendAnother")}
            </Button>
            <Button type="button" onClick={() => router.push("/")}>
              {t("common.backToFeed")}
            </Button>
          </div>
        </Card>
      </PageShell>
    );
  }

  const remaining = 2000 - message.length;
  const nearLimit = remaining <= 200;

  return (
    <PageShell className="max-w-xl px-4 py-6 md:px-6 md:py-10">
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold text-deep-plum">{t("feedback.title")}</h1>
        <p className="text-gray-700">{t("feedback.intro")}</p>
      </header>

      <Card className="space-y-6">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Kind selector */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-deep-plum">{t("feedback.kind")}</legend>
            <div className="flex flex-wrap gap-2">
              {KINDS.map(({ value, labelKey }) => {
                const selected = kind === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setKind(value)}
                    className={[
                      "min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition",
                      "border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle",
                      selected
                        ? "gradient-aurora border-transparent text-white shadow-sm"
                        : "border-[#CDBDEB] bg-white text-deep-plum hover:bg-soft-lilac/20",
                    ].join(" ")}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Message */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-deep-plum" htmlFor="feedback-message">
              {t("feedback.message")}
            </label>
            <Textarea
              id="feedback-message"
              className="min-h-32"
              placeholder={t("feedback.placeholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              required
            />
            {nearLimit && (
              <p className={`text-right text-xs ${remaining <= 50 ? "text-rose-600" : "text-gray-500"}`}>
                {remaining} characters remaining
              </p>
            )}
          </div>

          {/* Privacy note */}
          <p className="rounded-xl bg-soft-lilac/20 px-3 py-2.5 text-[13px] leading-snug text-gray-600">
            🔒 {t("feedback.privacy")}
          </p>

          {error && <p className="text-sm text-red-700" role="alert"><FriendlyErrorMessage message={error} /></p>}

          <Button
            type="submit"
            className="w-full"
            disabled={message.trim().length < 5 || sending}
          >
            {sending ? t("feedback.sending") : t("feedback.send")}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
