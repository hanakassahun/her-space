"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en, { type TranslationKey } from "@/lib/i18n/en";
import am from "@/lib/i18n/am";

export type Language = "en" | "am";

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readCookieLanguage(): Language | null {
  const match = document.cookie.match(/(?:^|;\s*)lang=(en|am)(?:;|$)/);
  return match?.[1] === "am" ? "am" : match?.[1] === "en" ? "en" : null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("lang");
    const storedLang = saved === "am" || saved === "en" ? saved : readCookieLanguage();
    if (storedLang) setLangState(storedLang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((nextLang: Language) => {
    setLangState(nextLang);
    window.localStorage.setItem("lang", nextLang);
    document.cookie = `lang=${nextLang}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const t = useCallback((key: TranslationKey) => {
    if (lang === "am") return am[key] || en[key];
    return en[key];
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
