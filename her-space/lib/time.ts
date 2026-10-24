import type { TranslationKey } from "@/lib/i18n/en";

export type SupportedLanguage = "en" | "am";

export function formatShortDate(dateValue: string | Date, lang: SupportedLanguage) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  const locale = lang === "am" ? "am-ET" : "en-US";
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

  if (date.getFullYear() !== now.getFullYear()) {
    options.year = "numeric";
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatRelativeDate(
  dateValue: string | Date,
  lang: SupportedLanguage,
  t: (key: TranslationKey) => string,
) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return formatShortDate(dateValue, lang);

  const deltaMinutes = (Date.now() - date.getTime()) / 60000;
  if (Math.abs(deltaMinutes) < 1) return t("time.justNow");

  const rtf = new Intl.RelativeTimeFormat(lang === "am" ? "am" : "en", {
    numeric: "auto",
    style: "short",
  });

  if (Math.abs(deltaMinutes) < 60) {
    return rtf.format(Math.round(-deltaMinutes), "minute");
  }

  const deltaHours = deltaMinutes / 60;
  if (Math.abs(deltaHours) < 24) {
    return rtf.format(Math.round(-deltaHours), "hour");
  }

  const deltaDays = deltaHours / 24;
  if (Math.abs(deltaDays) < 7) {
    return rtf.format(Math.round(-deltaDays), "day");
  }

  const deltaWeeks = deltaDays / 7;
  if (Math.abs(deltaWeeks) < 5) {
    return rtf.format(Math.round(-deltaWeeks), "week");
  }

  return formatShortDate(dateValue, lang);
}
