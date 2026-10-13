/**
 * Platform API `type` strings returned in JSON error bodies.
 * Shared SSOT for backend responders and frontend `mapPlatformAuthError`.
 */

/** Codes thrown via `PlatformError` (setup, password, admin ops). */
export const PLATFORM_SERVICE_ERROR_CODES = [
  "setup_not_needed",
  "invalid_email",
  "invalid_name",
  "password_too_short",
  "password_weak",
  "email_send_failed",
  "smtp_required",
  "invalid_setup",
  "invalid_code",
  "too_many_attempts",
  "user_exists",
  "invalid_reset",
  "invalid_current_password",
  "user_not_found",
  "forbidden",
] as const;

/** @see PLATFORM_SERVICE_ERROR_CODES */
export type PlatformServiceErrorCode = (typeof PLATFORM_SERVICE_ERROR_CODES)[number];

/**
 * HTTP/middleware/route error `type` values (not always thrown as `PlatformError`).
 */
export const PLATFORM_HTTP_ERROR_TYPES = [
  "invalid_credentials",
  "account_disabled",
  "auth_required",
  "session_revoked",
  "validation_error",
  "rate_limit_exceeded",
  "not_found",
  "database_error",
  "remote_migrate_disabled",
  "migrate_restart_in_progress",
  "two_factor_unavailable",
] as const;

/** @see PLATFORM_HTTP_ERROR_TYPES */
export type PlatformHttpErrorType = (typeof PLATFORM_HTTP_ERROR_TYPES)[number];

/** Full set of platform API error `type` values clients may receive. */
export const PLATFORM_API_ERROR_TYPES = [
  ...PLATFORM_SERVICE_ERROR_CODES,
  ...PLATFORM_HTTP_ERROR_TYPES,
] as const;

/** @see PLATFORM_API_ERROR_TYPES */
export type PlatformApiErrorType = (typeof PLATFORM_API_ERROR_TYPES)[number];

/** HTTP status for service-layer `PlatformError` codes. */
export const PLATFORM_SERVICE_ERROR_STATUSES: Record<PlatformServiceErrorCode, number> = {
  setup_not_needed: 409,
  invalid_email: 400,
  invalid_name: 400,
  password_too_short: 400,
  password_weak: 400,
  email_send_failed: 502,
  smtp_required: 503,
  invalid_setup: 404,
  invalid_code: 401,
  too_many_attempts: 429,
  user_exists: 409,
  invalid_reset: 404,
  invalid_current_password: 401,
  user_not_found: 404,
  forbidden: 403,
};
