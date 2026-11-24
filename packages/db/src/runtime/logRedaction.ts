/**
 * Log redaction policy.
 *
 * Shared by BOTH pino instances — the standalone `lib/logger.ts` (worker,
 * bootstrap, DB init) and Fastify's request logger (`app.ts`) — so a secret
 * cannot leak through whichever logger happens to be in scope.
 *
 * Why redaction at all: logs are shipped, indexed, retained, and readable by
 * anyone with log access, which is a far broader audience than the API response
 * that legitimately carries a token. A single `logger.error({ err })` on an
 * error object that happens to carry a request body is enough to write a
 * password or bearer token into durable storage.
 *
 * This is DEFENSE IN DEPTH, not a licence to log credentials: code must still
 * avoid passing them in the first place (see `lib/devLogging.ts`).
 */

/**
 * Field names treated as sensitive wherever they appear.
 *
 * Deliberately excludes a bare `code`: error codes (`err.code`) are essential
 * diagnostics, and PostgreSQL SQLSTATE values ride on that key. Credential-ish
 * code fields are listed explicitly instead (`otp`, `otpCode`, `verificationCode`,
 * `devCode`, `twoFactorCode`).
 */
const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "newPassword",
  "currentPassword",
  "initialPassword",
  "temporaryPassword",
  "confirmPassword",
  "passwordConfirmation",
  "token",
  "tokenHash",
  "accessToken",
  "refreshToken",
  "idToken",
  "resetToken",
  "verificationToken",
  "secret",
  "clientSecret",
  "jwtSecret",
  "apiKey",
  "api_key",
  "privateKey",
  "authorization",
  "cookie",
  "set-cookie",
  "csrf",
  "csrfToken",
  "otp",
  "otpCode",
  "twoFactorCode",
  "verificationCode",
  "devCode",
  "credentials",
] as const;

/**
 * Builds pino redact paths for each key at the top level and up to two levels
 * deep.
 *
 * pino's wildcard (`*`) matches exactly one segment, so each depth needs its own
 * path: `password` (top level), `*.password` (depth 2, e.g. `{ user: { password } }`),
 * and `*.*.password` (depth 3, e.g. `{ err: { data: { password } } }` — a shape
 * that reaches logs whenever an error object carries a parsed request body).
 */
function buildRedactPaths(): string[] {
  const paths: string[] = [];
  for (const key of SENSITIVE_KEYS) {
    paths.push(key);
    paths.push(`*.${key}`);
    paths.push(`*.*.${key}`);
  }
  // Header locations that pino's serializer sees verbatim.
  paths.push(
    "req.headers.authorization",
    "req.headers.cookie",
    "headers.authorization",
    "headers.cookie",
  );
  paths.push('res.headers["set-cookie"]', "res.headers.set-cookie");
  return paths;
}

export const LOG_REDACT_PATHS: string[] = buildRedactPaths();

/** Marker written in place of a redacted value. */
export const LOG_REDACT_CENSOR = "[Redacted]";

/** Pass straight into a pino / Fastify logger `redact` option. */
export const LOG_REDACTION_OPTIONS = {
  paths: LOG_REDACT_PATHS,
  censor: LOG_REDACT_CENSOR,
} as const;
