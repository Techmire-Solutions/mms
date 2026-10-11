import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiClient";
import {
  getPlatformErrorMessage,
  isPlatformApiErrorType,
  mapPlatformAuthError,
} from "@/platform/lib/platformAuthErrors";
import type { AppTranslationKey } from "@mms/shared";

const EN: Record<string, string> = {
  "platform.setupInvalidEmail": "Enter a valid email address",
  "platform.invalidCredentials": "Invalid platform credentials",
  "platform.setupSmtpRequired": "SMTP required",
  "platform.setupEmailFailed": "Email failed",
  "platform.otpTooManyAttempts": "Too many attempts",
  "platform.accountDisabled": "Account disabled",
  "platform.authRequired": "Auth required",
  "platform.sessionRevoked": "Session revoked",
  "platform.databaseError": "Database error",
  "platform.resourceNotFound": "Not found",
  "platform.rateLimited": "Rate limited",
  "platform.actionForbidden": "You do not have permission to perform this action.",
  "platform.profileMigrateRestartDisabled": "Remote migrate disabled",
  "platform.profileMigrateRestartInProgress": "Migrate already in progress",
  "platform.setupSessionExpired": "Setup expired",
  "platform.adminAlreadyExists": "Admin exists",
  "platform.setupPasswordTooShort": "Password must be at least {min} characters",
  "errors.boundary.description": "Something went wrong. Reload the page or try again later.",
};

function t(key: AppTranslationKey, params?: Record<string, string>): string {
  let str = EN[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }
  return str;
}

describe("platformAuthErrors", () => {
  it("identifies recognized PlatformApiErrorType strings with type guard", () => {
    expect(isPlatformApiErrorType("invalid_email")).toBe(true);
    expect(isPlatformApiErrorType("forbidden")).toBe(true);
    expect(isPlatformApiErrorType("unknown_code")).toBe(false);
    expect(isPlatformApiErrorType(null)).toBe(false);
    expect(isPlatformApiErrorType(123)).toBe(false);
  });

  it("maps known ApiError types to translation keys", () => {
    expect(mapPlatformAuthError(new ApiError(400, "bad", "invalid_email"), t)).toBe(
      "Enter a valid email address",
    );
    expect(mapPlatformAuthError(new ApiError(401, "nope", "invalid_credentials"), t)).toBe(
      "Invalid platform credentials",
    );
    expect(mapPlatformAuthError(new ApiError(409, "exists", "setup_not_needed"), t)).toBe(
      "platform.setupNotNeeded",
    );
    expect(mapPlatformAuthError(new ApiError(503, "smtp", "smtp_required"), t)).toBe(
      "SMTP required",
    );
    expect(mapPlatformAuthError(new ApiError(502, "send", "email_send_failed"), t)).toBe(
      "Email failed",
    );
    expect(mapPlatformAuthError(new ApiError(429, "otp", "too_many_attempts"), t)).toBe(
      "Too many attempts",
    );
    expect(mapPlatformAuthError(new ApiError(401, "off", "account_disabled"), t)).toBe(
      "Account disabled",
    );
    expect(mapPlatformAuthError(new ApiError(429, "rl", "rate_limit_exceeded"), t)).toBe(
      "Rate limited",
    );
    expect(mapPlatformAuthError(new ApiError(403, "off", "remote_migrate_disabled"), t)).toBe(
      "Remote migrate disabled",
    );
    expect(mapPlatformAuthError(new ApiError(409, "busy", "migrate_restart_in_progress"), t)).toBe(
      "Migrate already in progress",
    );
    expect(mapPlatformAuthError(new ApiError(404, "gone", "invalid_setup"), t)).toBe(
      "Setup expired",
    );
    expect(mapPlatformAuthError(new ApiError(409, "dup", "user_exists"), t)).toBe("Admin exists");
    expect(mapPlatformAuthError(new ApiError(401, "auth", "auth_required"), t)).toBe(
      "Auth required",
    );
    expect(mapPlatformAuthError(new ApiError(401, "revoked", "session_revoked"), t)).toBe(
      "Session revoked",
    );
    expect(mapPlatformAuthError(new ApiError(500, "db", "database_error"), t)).toBe(
      "Database error",
    );
    expect(mapPlatformAuthError(new ApiError(404, "missing", "not_found"), t)).toBe("Not found");
    expect(mapPlatformAuthError(new ApiError(400, "short", "password_too_short"), t)).toBe(
      "Password must be at least 10 characters",
    );
  });

  it("falls back to HTTP status code when error type is unmapped or omitted", () => {
    expect(mapPlatformAuthError(new ApiError(401, "unauthorized", undefined), t)).toBe(
      "Auth required",
    );
    expect(mapPlatformAuthError(new ApiError(403, "denied", undefined), t)).toBe(
      "You do not have permission to perform this action.",
    );
    expect(mapPlatformAuthError(new ApiError(404, "missing", undefined), t)).toBe("Not found");
    expect(mapPlatformAuthError(new ApiError(429, "slow down", undefined), t)).toBe("Rate limited");
  });

  it("does not surface raw API messages for unknown types and unmapped statuses", () => {
    expect(mapPlatformAuthError(new ApiError(500, "SQL boom detail", "server_error"), t)).toBe(
      "Something went wrong. Reload the page or try again later.",
    );
  });

  it("maps generic errors without leaking Error.message", () => {
    expect(getPlatformErrorMessage(new Error("secret stack detail"), t)).toBe(
      "Something went wrong. Reload the page or try again later.",
    );
    expect(getPlatformErrorMessage("weird", t)).toBe(
      "Something went wrong. Reload the page or try again later.",
    );
  });

  it("uses fallback translation key when error cannot be specifically mapped", () => {
    expect(
      getPlatformErrorMessage(
        new ApiError(500, "boom", "unknown_type"),
        t,
        undefined,
        "platform.accountDisabled",
      ),
    ).toBe("Account disabled");

    expect(
      getPlatformErrorMessage(
        new Error("generic failure"),
        t,
        undefined,
        "platform.accountDisabled",
      ),
    ).toBe("Account disabled");
  });
});
