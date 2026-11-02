/**
 * Server-owned contact write fields.
 *
 * Audit attribution must reflect the authenticated actor and the database clock,
 * never the request body: `mapAuditToInsert` writes these values straight into
 * the row (`created_by` / `updated_by`) and `createdAt` drives the Work metrics
 * and Reports month/year buckets. Accepting them from a client lets any writer
 * forge attribution and back-date a contact.
 */
export const CLIENT_AUDIT_OWNED_KEYS = ["createdAt", "createdBy", "updatedBy"] as const;

/** Strip client-supplied audit attribution from a contact write payload. */
export function stripClientAuditFields<T>(record: T): T {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return record;
  }
  const next = { ...(record as Record<string, unknown>) };
  for (const key of CLIENT_AUDIT_OWNED_KEYS) {
    delete next[key];
  }
  return next as T;
}
