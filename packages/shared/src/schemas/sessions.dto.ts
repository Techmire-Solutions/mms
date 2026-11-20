import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";
import { SessionInsertSchema } from "../sessions/sessionTypes.js";
import { stripSessionClientSoftDeleteFields } from "../sessions/sessionUtils.js";
import { stripClientAuditFields } from "../contacts/contactWriteSanitize.js";
import { bulkIdsBodySchema, type BulkIdsBody } from "./api.dto.js";

// Canonical write shape: server-owned audit/OCC/soft-delete controls are omitted and child ids are
// optional (the persist layer generates them), reusing `SessionInsertSchema` rather than rebuilding it.
const sessionCreateBodyBaseSchema = SessionInsertSchema;

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

/**
 * Removes nested server-owned/derived fields the read schema carries but the persist layer
 * re-derives (or manages server-side): class/section `enrolled` (computed from enrollments),
 * section `classTeacherId`/`classTeacherName` (resolved from staff assignments), and
 * faculty `createdAt`. Accepting them keeps the full record round-trippable; stripping them here
 * stops a future persist-layer change from silently writing client data.
 */
function stripSessionReadOnlyNestedFields(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const next = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(next.classes)) {
    next.classes = (next.classes as Record<string, unknown>[]).map((cls) => {
      const c = { ...cls };
      delete c.enrolled;
      if (Array.isArray(c.sections)) {
        c.sections = (c.sections as Record<string, unknown>[]).map((section) => {
          const s = { ...section };
          delete s.classTeacherId;
          delete s.classTeacherName;
          delete s.enrolled;
          return s;
        });
      }
      return c;
    });
  }
  if (Array.isArray(next.faculty)) {
    next.faculty = (next.faculty as Record<string, unknown>[]).map((member) => {
      const m = { ...member };
      delete m.createdAt;
      return m;
    });
  }
  return next;
}

export const sessionCreateBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const stripped = stripClientAuditFields(
    stripSessionReadOnlyNestedFields(
      stripServerOwnedSessionFields(
        stripSessionClientSoftDeleteFields(raw as Record<string, unknown>),
      ),
    ),
  );
  return deepSanitizeStrings(stripped);
}, sessionCreateBodyBaseSchema);

const sessionUpdateBodyBaseSchema = sessionCreateBodyBaseSchema
  .partial()
  .extend({
    /** Required (with Sessions setup rights) to make locked changes to a started session; audited. */
    lockOverrideReason: z.string().trim().min(3).max(500).optional(),
    /**
     * Why the session is being cancelled. Required by the server whenever `status` becomes
     * `cancelled`, on every path (this form and the dedicated cancel action alike).
     */
    cancellationReason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const sessionUpdateBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const stripped = stripClientAuditFields(
    stripSessionReadOnlyNestedFields(
      stripServerOwnedSessionFields(
        stripSessionClientSoftDeleteFields(raw as Record<string, unknown>),
      ),
    ),
  );
  return deepSanitizeStrings(stripped);
}, sessionUpdateBodyBaseSchema);

export const sessionsBulkIdsSchema = bulkIdsBodySchema;

export type SessionCreateBody = z.infer<typeof sessionCreateBodySchema>;
export type SessionUpdateBody = z.infer<typeof sessionUpdateBodySchema>;
export type SessionsBulkIdsBody = BulkIdsBody;
