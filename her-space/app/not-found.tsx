"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useLanguage } from "@/components/LanguageProvider";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg space-y-5 text-center shadow-[0_20px_60px_rgba(84,54,110,0.12)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-soft-lilac/40 text-3xl text-deep-plum">?</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-deep-plum">{t("notfound.title")}</h1>
          <p className="text-sm leading-6 text-gray-700">{t("notfound.body")}</p>
        </div>

        <Link href="/">
          <Button className="w-full">{t("error.home")}</Button>
        </Link>
      </Card>
    </div>
  );
}
