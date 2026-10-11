import type { AppTranslationKey } from "@mms/shared";
import { isApiError } from "@/lib/apiClient";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";

/**
 * Surfaces API failures via notify — honors 429 / Retry-After with localized copy.
 */
export function notifyApiFailure(
  error: unknown,
  t: TranslationFunction,
  fallbackKey: AppTranslationKey = "settings.serverSaveFailed",
): void {
  if (isApiError(error) && (error.status === 429 || error.type === "rate_limit_exceeded")) {
    const seconds = error.retryAfterSeconds;
    notify.error(t("errors.rate_limit_exceeded"), {
      description:
        seconds !== undefined
          ? t("errors.retryAfterSeconds", { seconds: String(seconds) })
          : undefined,
      duration: seconds !== undefined ? Math.min(Math.max(seconds, 5), 60) * 1000 : undefined,
    });
    return;
  }
  notify.error(t(fallbackKey));
}
