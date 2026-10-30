import { isApiError } from "@/lib/apiError";

/**
 * Retry policy for React Query reads.
 *
 * Deterministic client errors are never retried: repeating a 404/409/422/429 only
 * adds load and, for 429, hammers a server that asked us to wait. Server failures
 * keep the existing three-attempt exponential backoff, and a `Retry-After` header
 * (surfaced on `ApiError` by the contract helpers) wins over the backoff.
 */
const NO_RETRY_STATUSES = new Set([401, 403, 404, 409, 422, 429]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && NO_RETRY_STATUSES.has(error.status)) return false;
  return failureCount < MAX_RETRIES;
}

export function computeRetryDelay(attemptIndex: number, error: unknown): number {
  if (isApiError(error) && typeof error.retryAfterSeconds === "number") {
    return Math.min(Math.max(0, error.retryAfterSeconds) * 1000, MAX_DELAY_MS);
  }
  return Math.min(BASE_DELAY_MS * 2 ** attemptIndex, MAX_DELAY_MS);
}
