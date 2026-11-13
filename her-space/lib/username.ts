import { friendlyError } from "@/lib/errors";
import type { TranslationKey } from "@/lib/i18n/en";

type Translator = (key: TranslationKey) => string;

export type UsernameAvailability = "ok" | "yours" | "taken" | "reserved" | "invalid";

export function sanitizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export function usernameErrorMessage(error: unknown, t: Translator) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message.toLowerCase()
    : "";

  if (code === "23505" || message.includes("username_taken")) return t("username.taken");
  if (message.includes("username_reserved")) return t("username.reserved");
  if (message.includes("username_too_soon")) return t("username.tooSoon");
  if (message.includes("invalid_username")) return t("username.invalid");
  return friendlyError(error, t);
}
