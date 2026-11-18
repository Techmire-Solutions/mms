import type { AppTranslationKey } from "@mms/shared";
import { isApiError } from "@/lib/apiClient";
import { isConflictError } from "@/lib/apiContractError";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";

/**
 * Surfaces API failures via notify — honors 429 / Retry-After and 409 conflicts
 * with dedicated copy instead of a generic save failure.
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
  if (isConflictError(error)) {
    notify.error(t("errors.conflict"));
    return;
  }
  notify.error(t(fallbackKey));
}
