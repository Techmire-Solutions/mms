import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookVerificationOptions {
  /** Maximum acceptable drift between request timestamp and current server time (ms). Default: 5 minutes. */
  maxDriftMs?: number;
  /** Current time for testing/mocking purposes. */
  currentTimeMs?: number;
}

const DEFAULT_MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verifies an incoming EdTech webhook signature (OneRoster 1.2 REST, Clever, Google Classroom).
 *
 * Prevents replay attacks by bounding timestamp drift and prevents timing attacks using
 * constant-time buffer comparison (`crypto.timingSafeEqual`).
 */
export function verifyEdtechWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string,
  timestamp?: string | number,
  options?: WebhookVerificationOptions,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const maxDriftMs = options?.maxDriftMs ?? DEFAULT_MAX_DRIFT_MS;
  const now = options?.currentTimeMs ?? Date.now();

  // Validate timestamp freshness if provided
  if (timestamp !== undefined && timestamp !== null) {
    const timestampMs =
      typeof timestamp === "number"
        ? timestamp
        : /^\d+$/.test(String(timestamp).trim())
          ? Number(timestamp) * (String(timestamp).length === 10 ? 1000 : 1)
          : Date.parse(String(timestamp));

    if (isNaN(timestampMs)) {
      return false;
    }

    if (Math.abs(now - timestampMs) > maxDriftMs) {
      return false; // Stale or future-dated replay
    }
  }

  // Compute expected HMAC-SHA256
  const hmac = createHmac("sha256", secret);
  if (timestamp !== undefined && timestamp !== null) {
    hmac.update(`${timestamp}.`);
  }
  const bodyBuffer = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  hmac.update(bodyBuffer);
  const expectedSignatureHex = hmac.digest("hex");

  // Normalize provided signature (stripping prefixes like "v1=", "sha256=", etc.)
  const cleanSignature = signature.trim().replace(/^(?:v1=|sha256=)/i, "");

  const expectedBuffer = Buffer.from(expectedSignatureHex, "hex");
  const providedBuffer = Buffer.from(cleanSignature, "hex");

  if (expectedBuffer.length !== providedBuffer.length || expectedBuffer.length === 0) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Calculates exponential backoff with full jitter to avoid thundering-herd issues on external LMS APIs.
 */
export function calculateExponentialBackoff(
  attempt: number,
  options?: {
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitter?: boolean;
  },
): number {
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 30_000;
  const withJitter = options?.jitter ?? true;

  const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, Math.max(0, attempt)));
  if (!withJitter) {
    return expDelay;
  }

  // Full jitter: random value between 0 and expDelay
  return Math.floor(Math.random() * expDelay);
}

/**
 * Checks whether an OAuth2 token is expired or about to expire within the buffer window.
 * Default buffer: 5 minutes (300,000ms).
 */
export function isTokenExpired(
  expiresAt: number | Date | string,
  bufferMs: number = 5 * 60 * 1000,
): boolean {
  const expiryTimeMs =
    expiresAt instanceof Date
      ? expiresAt.getTime()
      : typeof expiresAt === "number"
        ? expiresAt * (expiresAt < 10_000_000_000 ? 1000 : 1)
        : Date.parse(expiresAt);

  if (isNaN(expiryTimeMs)) {
    return true;
  }

  return Date.now() + bufferMs >= expiryTimeMs;
}
