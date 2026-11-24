/**
 * Timeout budgets for outbound network calls.
 *
 * Every outbound call must be bounded. Without an explicit budget a hung
 * provider holds the caller open — for a request handler that means a stalled
 * user request until the global `REQUEST_TIMEOUT_MS`, and for a worker job it
 * means a stuck queue slot.
 *
 * Kept in one place so the API, worker, and email paths cannot drift apart.
 */

/** Generic outbound HTTP budget (Resend, LLM providers, webhooks). */
export const OUTBOUND_HTTP_TIMEOUT_MS = 15_000;

/**
 * SMTP budgets for `nodemailer`.
 *
 * These MUST be set explicitly: nodemailer's own defaults are far too long for a
 * request path — `socketTimeout` defaults to 10 minutes, so a server that
 * accepts the connection and then stalls would pin the caller for that long.
 */
export const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
export const SMTP_GREETING_TIMEOUT_MS = 10_000;
export const SMTP_SOCKET_TIMEOUT_MS = 20_000;

/** Spread into a `nodemailer.createTransport` options object. */
export const SMTP_TIMEOUT_OPTIONS = {
  connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
  greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
  socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
} as const;
