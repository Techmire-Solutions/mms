import { describe, expect, it } from "vitest";
import pino from "pino";
import { LOG_REDACT_CENSOR, LOG_REDACTION_OPTIONS, LOG_REDACT_PATHS } from "../lib/logRedaction.js";
import {
  DEV_CREDENTIAL_LOGGING_ENV_VAR,
  isDevCredentialLoggingEnabled,
  maskEmail,
} from "../lib/devLogging.js";

/**
 * Captures what a pino logger actually writes for a given payload.
 *
 * Testing through a real pino instance (rather than asserting on the config
 * object) is the point: pino's wildcard semantics are subtle — `*.password`
 * does NOT match a top-level `password` — so only the serialized output proves
 * the coverage is right.
 */
function captureLog(payload: Record<string, unknown>): Record<string, unknown> {
  const lines: string[] = [];
  const stream = { write: (line: string) => lines.push(line) };
  const logger = pino({ redact: LOG_REDACTION_OPTIONS }, stream);
  logger.info(payload, "test");
  return JSON.parse(lines[0]!) as Record<string, unknown>;
}

describe("log redaction", () => {
  it("redacts top-level credential fields", () => {
    const out = captureLog({
      password: "hunter2",
      token: "abc",
      apiKey: "k",
      secret: "s",
      initialPassword: "Mms#secret",
    });
    expect(out.password).toBe(LOG_REDACT_CENSOR);
    expect(out.token).toBe(LOG_REDACT_CENSOR);
    expect(out.apiKey).toBe(LOG_REDACT_CENSOR);
    expect(out.secret).toBe(LOG_REDACT_CENSOR);
    expect(out.initialPassword).toBe(LOG_REDACT_CENSOR);
  });

  it("redacts credential fields nested one level deep", () => {
    const out = captureLog({
      user: { passwordHash: "salt:hash", refreshToken: "rt" },
      input: { newPassword: "p", currentPassword: "p" },
    });
    expect((out.user as Record<string, unknown>).passwordHash).toBe(LOG_REDACT_CENSOR);
    expect((out.user as Record<string, unknown>).refreshToken).toBe(LOG_REDACT_CENSOR);
    expect((out.input as Record<string, unknown>).newPassword).toBe(LOG_REDACT_CENSOR);
    expect((out.input as Record<string, unknown>).currentPassword).toBe(LOG_REDACT_CENSOR);
  });

  it("redacts authorization and cookie headers", () => {
    const out = captureLog({
      req: { headers: { authorization: "Bearer eyJhbGci", cookie: "csrf_token=x" } },
    });
    const headers = (out.req as { headers: Record<string, unknown> }).headers;
    expect(headers.authorization).toBe(LOG_REDACT_CENSOR);
    expect(headers.cookie).toBe(LOG_REDACT_CENSOR);
  });

  it("redacts credential-code fields", () => {
    const out = captureLog({
      otp: "123456",
      otpCode: "123456",
      verificationCode: "123456",
      twoFactorCode: "123456",
      devCode: "123456",
    });
    for (const key of ["otp", "otpCode", "verificationCode", "twoFactorCode", "devCode"]) {
      expect(out[key]).toBe(LOG_REDACT_CENSOR);
    }
  });

  /**
   * The guard rail that keeps redaction from being counter-productive: error
   * codes are load-bearing diagnostics (PostgreSQL SQLSTATE rides on `err.code`),
   * so a bare `code` must stay readable.
   */
  it("does NOT redact a bare `code`, which carries error/SQLSTATE diagnostics", () => {
    const out = captureLog({ err: { code: "25006" }, code: "rate_limited" });
    expect((out.err as Record<string, unknown>).code).toBe("25006");
    expect(out.code).toBe("rate_limited");
  });

  it("leaves ordinary fields untouched", () => {
    const out = captureLog({ route: "/api/users/:id", statusCode: 200, durationMs: 12 });
    expect(out.route).toBe("/api/users/:id");
    expect(out.statusCode).toBe(200);
    expect(out.durationMs).toBe(12);
  });

  it("covers every sensitive key at both top level and one level deep", () => {
    const paths = new Set(LOG_REDACT_PATHS);
    for (const path of [...paths]) {
      if (path.startsWith("*.")) {
        expect(paths.has(path.slice(2))).toBe(true);
      }
    }
  });
});

describe("dev credential logging gate", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env[DEV_CREDENTIAL_LOGGING_ENV_VAR];

  function restore(): void {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env[DEV_CREDENTIAL_LOGGING_ENV_VAR];
    else process.env[DEV_CREDENTIAL_LOGGING_ENV_VAR] = originalFlag;
  }

  it("is off by default even outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env[DEV_CREDENTIAL_LOGGING_ENV_VAR];
    expect(isDevCredentialLoggingEnabled()).toBe(false);
    restore();
  });

  /**
   * The reason the flag exists: "not production" alone is too weak a signal, so
   * a staging box with NODE_ENV unset must not start writing real OTPs to logs.
   */
  it("stays off in a non-production environment with NODE_ENV unset", () => {
    delete process.env.NODE_ENV;
    process.env[DEV_CREDENTIAL_LOGGING_ENV_VAR] = "true";
    expect(isDevCredentialLoggingEnabled()).toBe(false);
    restore();
  });

  it("is on only when both conditions hold", () => {
    process.env.NODE_ENV = "development";
    process.env[DEV_CREDENTIAL_LOGGING_ENV_VAR] = "true";
    expect(isDevCredentialLoggingEnabled()).toBe(true);
    restore();
  });

  it("never enables in production, even with the flag set", () => {
    process.env.NODE_ENV = "production";
    process.env[DEV_CREDENTIAL_LOGGING_ENV_VAR] = "true";
    expect(isDevCredentialLoggingEnabled()).toBe(false);
    restore();
  });
});

describe("maskEmail", () => {
  it("keeps the domain and masks the identifying local part", () => {
    expect(maskEmail("teacher@example.com")).toBe("t***@example.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });

  it("handles missing or malformed values without throwing", () => {
    expect(maskEmail(undefined)).toBe("");
    expect(maskEmail(null)).toBe("");
    expect(maskEmail("")).toBe("");
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail("@example.com")).toBe("***");
  });
});
