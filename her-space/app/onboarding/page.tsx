"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import InterestPicker from "@/components/InterestPicker";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageShell from "@/components/ui/PageShell";
import { friendlyError } from "@/lib/errors";
import { cacheOnboarded } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

type AgeGroup = "teen" | "adult";

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [pageReady, setPageReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [message, setMessage] = useState("");
  const under13Removal = useRef(false);

  useEffect(() => {
    if (pageReady || terminated || under13Removal.current) return;
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const currentUser = user;

    let active = true;
    async function checkAgeRow() {
      try {
        const { data, error } = await supabase
          .from("member_private")
          .select("user_id")
          .eq("user_id", currentUser.id)
          .maybeSingle();
        if (!active) return;
        if (error) {
          setMessage(friendlyError(error, t));
          setPageReady(true);
          return;
        }
        if (data) {
          cacheOnboarded(currentUser.id);
          router.replace("/");
          return;
        }
        setPageReady(true);
      } catch (error: unknown) {
        if (!active) return;
        setMessage(friendlyError(error, t));
        setPageReady(true);
      }
    }
    void checkAgeRow();

    return () => {
      active = false;
    };
  }, [authLoading, pageReady, router, t, terminated, user]);

  async function saveAge(ageGroup: AgeGroup) {
    if (!user || saving) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("member_private").insert({ age_group: ageGroup });
    if (error && error.code !== "23505") {
      setMessage(friendlyError(error, t));
      setSaving(false);
      return;
    }
    cacheOnboarded(user.id);
    setStep(2);
    setSaving(false);
  }

  async function handleUnder13() {
    if (!user || saving) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setMessage(friendlyError(error, t));
      setSaving(false);
      return;
    }
    under13Removal.current = true;
    await supabase.auth.signOut();
    setTerminated(true);
    setSaving(false);
  }

  async function saveInterests() {
    if (!user || saving) return;
    setSaving(true);
    setMessage("");
    if (selectedInterests.length > 0) {
      const { error } = await supabase.from("member_interests").insert(
        selectedInterests.map((topic) => ({ user_id: user.id, topic: topic.toLowerCase() }))
      );
      if (error) {
        setMessage(friendlyError(error, t));
        setSaving(false);
        return;
      }
    }
    setStep(3);
    setSaving(false);
  }

  if (terminated) {
    return (
      <PageShell className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-10 md:px-6">
        <Card className="glass w-full space-y-4 text-center">
          <h1 className="text-2xl font-bold text-deep-plum">{t("onb.underTitle")}</h1>
          <p className="break-words leading-7 text-gray-700">{t("onb.underBody")}</p>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#CDBDEB] bg-white px-5 py-2 text-sm font-semibold text-deep-plum" href="/">
            {t("common.backHome")}
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-8 md:px-6 md:py-12">
      <Card className="glass w-full space-y-6">
        <div className="flex gap-2" aria-hidden="true">
          {[1, 2, 3].map((item) => (
            <span
              key={item}
              className={`h-1.5 flex-1 rounded-full ${item <= step ? "bg-deep-plum" : "bg-soft-lilac"}`}
            />
          ))}
        </div>

        {!pageReady ? (
          <div className="space-y-4" aria-busy="true">
            <div className="h-7 w-2/3 animate-pulse rounded bg-soft-lilac/60" />
            <div className="h-20 animate-pulse rounded-xl bg-soft-lilac/40" />
            <div className="h-14 animate-pulse rounded-xl bg-soft-lilac/40" />
          </div>
        ) : (
          <>
            {step === 1 && (
              <section className="space-y-4">
                <header className="space-y-2">
                  <h1 className="text-2xl font-bold text-deep-plum">{t("onb.ageTitle")}</h1>
                  <p className="break-words leading-7 text-gray-700">{t("onb.ageBody")}</p>
                </header>
                <div className="grid gap-3">
                  <Button className="min-h-14 w-full whitespace-normal break-words text-base" type="button" disabled={saving} onClick={() => void saveAge("teen")}>
                    {t("onb.age13")}
                  </Button>
                  <Button className="min-h-14 w-full whitespace-normal break-words text-base" variant="secondary" type="button" disabled={saving} onClick={() => void saveAge("adult")}>
                    {t("onb.age18")}
                  </Button>
                  <Button className="min-h-14 w-full whitespace-normal break-words text-base" variant="ghost" type="button" disabled={saving} onClick={() => void handleUnder13()}>
                    {t("onb.ageUnder")}
                  </Button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                <header className="space-y-2">
                  <h1 className="text-2xl font-bold text-deep-plum">{t("onb.interestsTitle")}</h1>
                  <p className="break-words leading-7 text-gray-700">{t("onb.interestsBody")}</p>
                </header>
                <div className="space-y-3">
                  <p className="text-right text-sm text-gray-600">{selectedInterests.length}/6</p>
                  <InterestPicker selected={selectedInterests} onChange={setSelectedInterests} disabled={saving} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" disabled={saving} onClick={() => void saveInterests()}>
                    {t("onb.continue")}
                  </Button>
                  <Button variant="secondary" type="button" disabled={saving} onClick={() => setStep(3)}>
                    {t("onb.skip")}
                  </Button>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-4">
                <header className="space-y-2">
                  <h1 className="text-2xl font-bold text-deep-plum">{t("onb.readingTitle")}</h1>
                  <p className="break-words leading-7 text-gray-700">{t("onb.readingBody")}</p>
                </header>
                <Button type="button" onClick={() => router.replace("/")}>{t("onb.start")}</Button>
              </section>
            )}
            {message && <p className="break-words text-sm text-red-700" role="alert">{message}</p>}
          </>
        )}
      </Card>
    </PageShell>
  );
}
