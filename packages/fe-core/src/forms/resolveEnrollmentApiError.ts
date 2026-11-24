import { isApiError } from "../api/errors";
import type { TranslationFunction } from "../i18n/types";
import { mapApiFormError } from "./serverFormErrors";
import { translateApiMessage } from "./translateValidationMessage";

/**
 * Maps an enrollment API error to localized copy, preserving the deadline day carried in
 * `details.day`. The shared deadline helpers now return a stable i18n key + day instead of an
 * English sentence, so a raw `translateApiMessage` would render the `{day}` placeholder literal.
 */
export function resolveEnrollmentApiError(
  error: unknown,
  t: TranslationFunction,
): string | undefined {
  if (isApiError(error)) {
    const day = typeof error.details?.day === "string" ? error.details.day : undefined;
    switch (error.type) {
      case "add_deadline_passed":
        return t("enrollments.errors.addDeadlinePassed", { day: day ?? "" });
      case "drop_deadline_passed":
        return t("enrollments.errors.dropDeadlinePassed", { day: day ?? "" });
      case "ineligible":
        return t("enrollments.errors.ineligible");
      default:
        break;
    }
  }
  return mapApiFormError(error, (message) => translateApiMessage(message, t)).message;
}
