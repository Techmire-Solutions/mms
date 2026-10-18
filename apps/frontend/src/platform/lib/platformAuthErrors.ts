import { PLATFORM_API_ERROR_TYPES, PLATFORM_MIN_PASSWORD_LENGTH } from "@mms/shared";
import type { AppTranslationKey, PlatformApiErrorType } from "@mms/shared";
import { ApiError } from "@/lib/apiClient";

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
} as const satisfies Record<PlatformApiErrorType, AppTranslationKey>;

const HTTP_STATUS_FALLBACK_KEYS: Partial<Record<number, AppTranslationKey>> = {
  401: "platform.authRequired",
  403: "platform.actionForbidden",
  404: "platform.resourceNotFound",
  429: "platform.rateLimited",
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
  if (isPlatformApiErrorType(apiError.type)) {
    const key = PLATFORM_AUTH_ERROR_KEYS[apiError.type];
    if (apiError.type === "password_too_short") {
      return t(key, { min: String(PLATFORM_MIN_PASSWORD_LENGTH), ...params });
    }
    return t(key, params);
  }

  // Fallback to standard HTTP status mapping if error type code is unmapped or omitted
  const statusKey = HTTP_STATUS_FALLBACK_KEYS[apiError.status];
  if (statusKey) {
    return t(statusKey, params);
  }

  return t("errors.boundary.description");
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
