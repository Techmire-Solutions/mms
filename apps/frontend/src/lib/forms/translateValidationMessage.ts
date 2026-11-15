import type { AppTranslationKey } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const EXACT_MESSAGE_KEYS: Record<string, AppTranslationKey> = {
  "Give a reason": "validation.reasonTooShort",
  "Use a 24-hour HH:mm time": "validation.timeFormat",
  "Time must be HH:mm": "validation.timeFormat",
  "Date must be in YYYY-MM-DD format": "validation.dateFormat",
  "Billing period must be YYYY-MM": "validation.billingPeriodFormat",
  "Timestamp must be ISO-8601 UTC ending in Z": "validation.timestampFormat",
  "Percentage must be 0-100": "validation.percentageRange",
  "Message body cannot be empty": "validation.messageEmpty",
  "Message cannot be empty": "validation.messageEmpty",
  "Choose at least one student": "validation.required",
};

const TRANSLATION_KEY_PATTERN = /^[a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+$/;

/**
 * Resolves a Zod/API message for display.
 *
 * Shared DTO schemas intentionally keep English messages at the API boundary.
 * Form surfaces route them through this resolver so a literal contract message
 * ("Title is required") renders localized copy, while an existing translation
 * key (`tasks.validation.titleRequired`) resolves normally. Unknown literal
 * messages fall back to a generic localized invalid-value message instead of
 * leaking English into ar/ur/fa.
 */
export function translateValidationMessage(
  message: string | null | undefined,
  t: TranslationFunction,
): string {
  const trimmed = (message ?? "").trim();
  if (!trimmed) return t("validation.invalid");

  if (TRANSLATION_KEY_PATTERN.test(trimmed)) {
    return t(trimmed as AppTranslationKey);
  }

  const exact = EXACT_MESSAGE_KEYS[trimmed];
  if (exact) return t(exact);

  if (/(?:^|\s)is required\.?$/i.test(trimmed) || /^required\.?$/i.test(trimmed)) {
    return t("validation.required");
  }

  return t("validation.invalid");
}

/**
 * Server/API messages are already localized or are contract copy; resolve them
 * through `t` only when they are translation keys, preserving the original text
 * otherwise (unknown keys return the key itself).
 */
export function translateApiMessage(
  message: string | null | undefined,
  t: TranslationFunction,
): string {
  return t((message ?? "") as AppTranslationKey);
}
