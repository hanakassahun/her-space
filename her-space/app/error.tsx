"use client";

import Link from "next/link";
import { useEffect } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useLanguage } from "@/components/LanguageProvider";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg space-y-6 border border-white/60 bg-white/75 text-center shadow-[0_20px_60px_rgba(84,54,110,0.12)] backdrop-blur-md">
        <div className="mx-auto w-40 text-[#7C5EA8]">
          <svg viewBox="0 0 220 140" className="h-auto w-full" aria-hidden="true" role="img">
            <circle cx="155" cy="34" r="22" fill="#F5E7FF" />
            <path
              d="M48 90c0-21.54 17.46-39 39-39 8.44 0 16.22 2.68 22.65 7.2 7.58-11.46 20.11-19.2 34.35-19.2 22.09 0 40 17.91 40 40 0 2.67-.27 5.28-.76 7.8H48Z"
              fill="#E5E7EB"
            />
            <path d="M72 98h92a12 12 0 0 1 12 12v3H60v-3a12 12 0 0 1 12-12Z" fill="#F8D5B0" opacity="0.8" />
            <path d="M76 90h76" stroke="#CAB7EA" strokeLinecap="round" strokeWidth="4" />
            <path d="M82 75c0-17 13.8-31 31-31 10.03 0 18.97 4.77 24.92 12.18" stroke="#CAB7EA" strokeLinecap="round" strokeWidth="4" fill="none" opacity="0.8" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-deep-plum">{t("error.title")}</h1>
          <p className="text-sm leading-6 text-gray-700">{t("error.body")}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()}>{t("error.retry")}</Button>
          <Link href="/">
            <Button variant="secondary" type="button" className="w-full sm:w-auto">
              {t("error.home")}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
