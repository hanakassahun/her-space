import type { TranslationKey } from "@/lib/i18n/en";

type Translator = (key: TranslationKey) => string;

export function friendlyError(error: unknown, t: Translator): string {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  if (message.includes("too fast") || message.includes("rate") || /after\s+\d+\s+seconds?/.test(message)) {
    return t("errors.rateLimit");
  }
  if (message.includes("fetch") || message.includes("network")) {
    return t("errors.network");
  }
  if (message.includes("jwt") || message.includes("expired") || message.includes("not authenticated")) {
    return t("errors.sessionExpired");
  }
  return t("errors.generic");
}