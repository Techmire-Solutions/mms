import { PLATFORM_API_ERROR_TYPES, PLATFORM_MIN_PASSWORD_LENGTH } from "@mms/contracts";
import type { AppTranslationKey, PlatformApiErrorType } from "@mms/contracts";
import { ApiError } from "@/lib/apiClient";
import { mapAuthError, type MapAuthErrorConfig } from "@/lib/mapAuthError";

type TranslateFn = (key: AppTranslationKey, params?: Record<string, string>) => string;

const PLATFORM_AUTH_ERROR_KEYS = {
  invalid_email: "platform.setupInvalidEmail",
  invalid_name: "platform.setupInvalidName",
  password_too_short: "platform.setupPasswordTooShort",
  password_weak: "platform.setupPasswordWeak",
  smtp_required: "platform.setupSmtpRequired",
  email_send_failed: "platform.setupEmailFailed",
  invalid_code: "platform.setupInvalidCode",
  invalid_setup: "platform.setupSessionExpired",
  invalid_reset: "platform.forgotResetExpired",
  too_many_attempts: "platform.otpTooManyAttempts",
  invalid_current_password: "platform.profileWrongPassword",
  invalid_credentials: "platform.invalidCredentials",
  account_disabled: "platform.accountDisabled",
  two_factor_unavailable: "platform.twoFactorUnavailable",
  setup_not_needed: "platform.setupNotNeeded",
  user_exists: "platform.adminAlreadyExists",
  user_not_found: "platform.adminNotFound",
  forbidden: "platform.actionForbidden",
  remote_migrate_disabled: "platform.profileMigrateRestartDisabled",
  migrate_restart_in_progress: "platform.profileMigrateRestartInProgress",
  rate_limit_exceeded: "platform.rateLimited",
  validation_error: "platform.validationFailed",
  auth_required: "platform.authRequired",
  session_revoked: "platform.sessionRevoked",
  database_error: "platform.databaseError",
  not_found: "platform.resourceNotFound",
  challenge_not_found: "platform.resourceNotFound",
} as const satisfies Record<PlatformApiErrorType, AppTranslationKey>;

const HTTP_STATUS_FALLBACK_KEYS: Partial<Record<number, AppTranslationKey>> = {
  401: "platform.authRequired",
  403: "platform.actionForbidden",
  404: "platform.resourceNotFound",
  429: "platform.rateLimited",
};

const PLATFORM_AUTH_ERROR_MAPPING: MapAuthErrorConfig = {
  isErrorType: isPlatformApiErrorType,
  keyMap: PLATFORM_AUTH_ERROR_KEYS,
  statusMap: HTTP_STATUS_FALLBACK_KEYS,
  fallbackKey: "errors.boundary.description",
};

/** Runtime type guard checking if an error code is a recognized PlatformApiErrorType. */
export function isPlatformApiErrorType(value: unknown): value is PlatformApiErrorType {
  return (
    typeof value === "string" && (PLATFORM_API_ERROR_TYPES as readonly string[]).includes(value)
  );
}

/** Maps platform setup / password-reset / admin API errors to translated copy. */
export function mapPlatformAuthError(
  apiError: ApiError,
  t: TranslateFn,
  params?: Record<string, string>,
): string {
  const resolvedParams =
    isPlatformApiErrorType(apiError.type) && apiError.type === "password_too_short"
      ? { min: String(PLATFORM_MIN_PASSWORD_LENGTH), ...params }
      : params;
  return mapAuthError(apiError, PLATFORM_AUTH_ERROR_MAPPING, t, resolvedParams);
}

/** Convenience wrapper to map any caught error (ApiError, TypeError, or generic Error) to a translated string. */
export function getPlatformErrorMessage(
  error: unknown,
  t: TranslateFn,
  params?: Record<string, string>,
  fallbackKey?: AppTranslationKey,
): string {
  if (error instanceof ApiError) {
    const mapped = mapPlatformAuthError(error, t, params);
    if (mapped !== t("errors.boundary.description")) {
      return mapped;
    }
  }
  if (fallbackKey) {
    return t(fallbackKey, params);
  }
  return t("errors.boundary.description");
}
