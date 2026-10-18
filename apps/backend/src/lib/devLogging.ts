/**
 * Gate for logging values that are only acceptable in local development.
 *
 * Some flows generate a one-time credential (2FA code, login-email change code)
 * that a developer needs to read without access to a real mailbox. Logging it is
 * a genuine convenience — but credentials in the log stream are shipped,
 * indexed, and retained, so it must never happen by default.
 *
 * Two conditions, both required:
 *   1. An EXPLICIT local environment (`NODE_ENV` is exactly `development` or
 *      `test`), and
 *   2. An explicit opt-in (`MMS_LOG_DEV_CREDENTIALS=true`).
 *
 * The first condition is an allow-list rather than `!== 'production'` on
 * purpose. "Not production" is a weak signal — a staging box with `NODE_ENV`
 * unset, or set to `staging`, would satisfy it and start writing real user OTPs
 * into durable, widely-readable logs. Unrecognised or missing values fail
 * closed.
 */
export const DEV_CREDENTIAL_LOGGING_ENV_VAR = "MMS_LOG_DEV_CREDENTIALS";

/** Environments where a developer is expected to be reading the logs directly. */
const LOCAL_ENVIRONMENTS = new Set(["development", "test"]);

export function isDevCredentialLoggingEnabled(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  if (!nodeEnv || !LOCAL_ENVIRONMENTS.has(nodeEnv)) return false;
  return process.env[DEV_CREDENTIAL_LOGGING_ENV_VAR] === "true";
}

/**
 * Masks an email address for log correlation without recording the full PII:
 * `faculty@example.com` → `f***@example.com`.
 *
 * Logs still need to correlate events to a user; the domain alone is usually
 * enough to distinguish environments, while the local part is the identifying
 * component.
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 1);
  return `${head}***${domain}`;
}
