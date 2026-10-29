import { randomUUID } from "node:crypto";

/**
 * Background-job ids are used as the `background_jobs.id` primary key and as the
 * BullMQ `jobId`. Client idempotency keys are only unique per user, so every
 * client-supplied id is namespaced with the tenant and the user before it
 * reaches either store.
 */
export const BACKGROUND_JOB_ID_MAX_LENGTH = 255;

/** Segment charset shared with the shared Zod idempotency-key schemas. */
const SAFE_SEGMENT = /^[A-Za-z0-9._~@-]+$/;

export class BackgroundJobIdValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackgroundJobIdValidationError";
  }
}

function normalizeSegment(value: string | null | undefined, label: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new BackgroundJobIdValidationError(`Background job id requires a ${label}`);
  }
  if (!SAFE_SEGMENT.test(trimmed)) {
    throw new BackgroundJobIdValidationError(
      `Background job id ${label} contains unsupported characters`,
    );
  }
  return trimmed;
}

/**
 * Builds a globally unique, namespaced background-job id.
 *
 * Returns a random UUID when the client did not send an idempotency key.
 * BullMQ only accepts `:` in custom job ids when the id has exactly three
 * segments, which is guaranteed by rejecting `:` in each segment.
 */
export function buildBackgroundJobId(
  tenant: string,
  userId: string,
  clientKey?: string | null,
): string {
  const key = clientKey?.trim();
  if (!key) return randomUUID();

  const tenantSegment = normalizeSegment(tenant, "tenant").toLowerCase();
  const userSegment = normalizeSegment(userId, "user");
  if (!SAFE_SEGMENT.test(key)) {
    throw new BackgroundJobIdValidationError(
      "Background job idempotency key contains unsupported characters",
    );
  }

  const jobId = `${tenantSegment}:${userSegment}:${key}`;
  if (jobId.length > BACKGROUND_JOB_ID_MAX_LENGTH) {
    throw new BackgroundJobIdValidationError(
      `Background job id exceeds ${BACKGROUND_JOB_ID_MAX_LENGTH} characters`,
    );
  }
  return jobId;
}
