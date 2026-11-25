/**
 * Hasanat batch (group) awarding contract — one request for a class section, a workshop group or an
 * explicit student list.
 *
 * Semantics:
 * - recipients are resolved server-side from live enrollments (never from client-supplied names);
 * - up to `HASANAT_BATCH_INLINE_MAX` recipients are issued inside one transaction (all-or-nothing);
 * - larger groups go through the `hasanat:bulk-award` job in chunks;
 * - each card gets a deterministic per-recipient idempotency key, so a retried request cannot
 *   duplicate a card;
 * - recipients that cannot be awarded are returned in `skipped` with a reason (deterministic, not a
 *   failure).
 */

import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

/** Above this many recipients the request is queued as a background job. */
export const HASANAT_BATCH_INLINE_MAX = 200;

/** Chunk size used by the background runner. */
export const HASANAT_BATCH_JOB_CHUNK = 100;

export const hasanatBatchTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("students"),
      studentIds: z.array(z.string().min(1)).min(1).max(1000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("class"),
      sessionId: z.string().min(1),
      classId: z.string().min(1),
      sectionId: z.string().nullable().optional(),
    })
    .strict(),
]);

export type HasanatBatchTarget = z.infer<typeof hasanatBatchTargetSchema>;

export const hasanatBatchAwardBodySchema = z
  .object({
    batchId: z.string().min(1, "Batch is required"),
    denominationId: z.string().min(1, "Denomination is required"),
    target: hasanatBatchTargetSchema,
    reason: z.string().min(1, "Reason is required").max(1000),
    issuedDate: isoDateSchema,
    expiresOn: isoDateSchema.nullable().optional(),
    /** Idempotency key for the whole request (per-card keys are derived from it). */
    clientRequestId: z.string().min(8).max(64),
  })
  .strict();

export type HasanatBatchAwardBody = z.infer<typeof hasanatBatchAwardBodySchema>;

export interface HasanatBatchRecipient {
  studentId: string;
  studentName: string;
  classId: string | null;
  sectionId: string | null;
  sessionId: string | null;
}

export const hasanatBatchRecipientsResponseSchema = z.object({
  recipients: z.array(
    z.object({
      studentId: z.string(),
      studentName: z.string(),
      classId: z.string().nullable(),
      sectionId: z.string().nullable(),
      sessionId: z.string().nullable(),
    }),
  ),
  count: z.number(),
  stockRemaining: z.number().nullable(),
  quotaRemaining: z.number().nullable(),
  requiresJob: z.boolean(),
});

export type HasanatBatchRecipientsResponse = z.infer<typeof hasanatBatchRecipientsResponseSchema>;

export const hasanatBatchAwardResultSchema = z.object({
  issued: z.number(),
  distributionIds: z.array(z.string()),
  skipped: z.array(z.object({ studentId: z.string(), reason: z.string() })),
  queued: z.boolean(),
  jobId: z.string().optional(),
});

export type HasanatBatchAwardResult = z.infer<typeof hasanatBatchAwardResultSchema>;

/** Deterministic per-card idempotency key for one recipient of a batch request. */
export function batchCardRequestId(requestId: string, studentId: string): string {
  // FNV-1a over `requestId:studentId` — stable, dependency-free, fits varchar(64).
  const input = `${requestId}:${studentId}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `bulk-${hash.toString(16).padStart(8, "0")}-${studentId}`.slice(0, 64);
}
