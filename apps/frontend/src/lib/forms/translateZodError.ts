import type { AppTranslationKey } from "@mms/shared";
import type { FieldErrors } from "react-hook-form";

/** Maps Zod i18n message keys on form fields to translated copy. */
export function firstZodFieldError<T extends Record<string, unknown>>(
  errors: FieldErrors<T>,
  t: (key: AppTranslationKey) => string,
): string {
  for (const value of Object.values(errors)) {
    if (!value) continue;
    if ("message" in value && typeof value.message === "string") {
      return t(value.message as AppTranslationKey);
    }
  }
  return "";
}
