 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { navConfig, resolveNavHref, type NavKey } from "@/lib/nav";
import NavIcon from "@/components/NavIcon";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";
import InstallBanner from "@/components/InstallBanner";
import WelcomeCards from "@/components/WelcomeCards";

export default function Home() {
  const { t } = useLanguage();
  const [name, setName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .single();
        setName(profile?.display_name ?? "friend");
        const { data: admin } = await supabase
          .from("admins")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        setIsAdmin(Boolean(admin));
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <PageShell className="flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="bg-clip-text text-5xl font-bold text-transparent gradient-aurora">Her Space</h1>
      <p className="mt-4 max-w-md text-lg text-deep-plum">
        {t("home.tagline")}
      </p>

      {!loading && name && (
        <section className="mt-8 w-full max-w-3xl space-y-4 text-left">
          <p className="text-center text-deep-plum">{t("home.welcome")} {name} 🌸</p>
          {userId && <WelcomeCards />}
          <InstallBanner />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(["feed", "explore", "learn", "journal", "library", "resources"] as NavKey[]).map((key) => {
              const item = navConfig[key];
              return (
                <Link href={resolveNavHref(key, userId ?? "")} key={key}>
                  <Card as="article" className="flex min-h-32 h-full flex-col justify-between text-deep-plum transition hover:-translate-y-0.5 hover:bg-white/80">
                    <NavIcon icon={item.icon} className="h-6 w-6 text-periwinkle" />
                    <span className="text-lg font-semibold">{t(item.label)}</span>
                  </Card>
                </Link>
              );
            })}
            {userId && (["profile", ...(isAdmin ? ["admin"] : [])] as NavKey[]).map((key) => {
              const item = navConfig[key];
              return (
                <Link href={resolveNavHref(key, userId)} key={key}>
                  <Card as="article" className="flex min-h-32 h-full flex-col justify-between text-deep-plum transition hover:-translate-y-0.5 hover:bg-white/80">
                    <NavIcon icon={item.icon} className="h-6 w-6 text-periwinkle" />
                    <span className="text-lg font-semibold">{t(item.label)}</span>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {!loading && !name && (
        <>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link className="gradient-aurora shadow-glow inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 font-semibold text-white" href="/signup">
              {t("home.signup")}
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 bg-white/65 px-6 py-3 font-semibold text-deep-plum" href="/login">
              {t("home.login")}
            </Link>
          </div>
          <footer className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-600">
            <Link className="underline underline-offset-4" href="/rules">{t("legal.rules")}</Link>
            <Link className="underline underline-offset-4" href="/privacy">{t("legal.privacy")}</Link>
            <Link className="underline underline-offset-4" href="/terms">{t("legal.terms")}</Link>
            <LanguageSwitcher />
          </footer>
        </>
      )}
    </PageShell>
  );
}