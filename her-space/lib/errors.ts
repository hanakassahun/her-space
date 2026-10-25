import type { TranslationKey } from "@/lib/i18n/en";

type Translator = (key: TranslationKey) => string;

function errorReference(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const parts: string[] = [];
  if ("status" in error) {
    if (typeof error.status === "number" && Number.isInteger(error.status)) {
      parts.push(String(error.status));
    } else if (typeof error.status === "string" && /^\d{3}$/.test(error.status)) {
      parts.push(error.status);
    }
  }

  const identifierPattern = /^[A-Za-z0-9_-]{1,64}$/;
  if ("code" in error && typeof error.code === "string" && identifierPattern.test(error.code)) {
    parts.push(error.code);
  } else if ("name" in error && typeof error.name === "string") {
    const firstNameWord = error.name.trim().split(/\s+/, 1)[0];
    if (firstNameWord && identifierPattern.test(firstNameWord)) parts.push(firstNameWord);
  }

  return parts.length ? parts.join(" ") : null;
}

export function friendlyError(error: unknown, t: Translator): string {
  console.error("[Her Space]", error);
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  let friendlyMessage: string;
  if (message.includes("too fast") || message.includes("rate") || /after\s+\d+\s+seconds?/.test(message)) {
    friendlyMessage = t("errors.rateLimit");
  } else if (message.includes("fetch") || message.includes("network")) {
    friendlyMessage = t("errors.network");
  } else if (message.includes("jwt") || message.includes("expired") || message.includes("not authenticated")) {
    friendlyMessage = t("errors.sessionExpired");
  } else {
    friendlyMessage = t("errors.generic");
  }

  const reference = errorReference(error);
  return reference ? `${friendlyMessage}\nRef: ${reference}` : friendlyMessage;
}