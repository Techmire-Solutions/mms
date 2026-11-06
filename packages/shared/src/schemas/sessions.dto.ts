import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";
import { SessionSchema } from "../sessions/sessionTypes.js";
import { stripSessionClientSoftDeleteFields } from "../sessions/sessionUtils.js";
import { stripClientAuditFields } from "../contacts/contactWriteSanitize.js";
import { bulkIdsBodySchema, type BulkIdsBody } from "./api.dto.js";

const sessionCreateBodyBaseSchema = SessionSchema.omit({
  deletedAt: true,
  deletedBy: true,
  deletionReason: true,
  restoredAt: true,
  restoredBy: true,
  deletedWithCascade: true,
  // Server-owned audit timestamps: never accepted from a client.
  createdAt: true,
  updatedAt: true,
  // Server-owned concurrency/overlap controls: a client must not be able to set either.
  version: true,
  overlapExempt: true,
})
  .extend({
    id: z.string().optional(),
  })
  .strict();

/**
 * A full session record round-trips through the client, so the concurrency and overlap controls it
 * carries are dropped here instead of failing the strict body schema. The server re-derives both.
 */
function stripServerOwnedSessionFields(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const next = { ...(raw as Record<string, unknown>) };
  delete next.version;
  delete next.overlapExempt;
  return next;
}

export const sessionCreateBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const stripped = stripClientAuditFields(
    stripServerOwnedSessionFields(
      stripSessionClientSoftDeleteFields(raw as Record<string, unknown>),
    ),
  );
  return deepSanitizeStrings(stripped);
}, sessionCreateBodyBaseSchema);

const sessionUpdateBodyBaseSchema = sessionCreateBodyBaseSchema
  .partial()
  .extend({
    /** Required (with Sessions setup rights) to make locked changes to a started session; audited. */
    lockOverrideReason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const sessionUpdateBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const stripped = stripClientAuditFields(
    stripServerOwnedSessionFields(
      stripSessionClientSoftDeleteFields(raw as Record<string, unknown>),
    ),
  );
  return deepSanitizeStrings(stripped);
}, sessionUpdateBodyBaseSchema);

export const sessionsBulkIdsSchema = bulkIdsBodySchema;

export type SessionCreateBody = z.infer<typeof sessionCreateBodySchema>;
export type SessionUpdateBody = z.infer<typeof sessionUpdateBodySchema>;
export type SessionsBulkIdsBody = BulkIdsBody;
