"use client";

import { useLanguage } from "@/components/LanguageProvider";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      className={`inline-flex min-h-9 items-center rounded-full border border-white/70 bg-white/70 p-1 text-xs font-medium ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        className={`min-h-8 rounded-full px-3 transition-colors ${lang === "en" ? "bg-soft-lilac text-deep-plum" : "text-gray-700 hover:bg-white"}`}
        type="button"
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
      >
        {t("language.english")}
      </button>
      <button
        className={`min-h-8 rounded-full px-3 transition-colors ${lang === "am" ? "bg-soft-lilac text-deep-plum" : "text-gray-700 hover:bg-white"}`}
        type="button"
        aria-pressed={lang === "am"}
        onClick={() => setLang("am")}
      >
        {t("language.amharic")}
      </button>
    </div>
  );
}