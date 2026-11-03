import { CONTACT_TAB_COLLECTION_KEYS } from "./contactCollectionKeys.js";

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

/**
 * Drops collections (and their scalar mirrors) that the loaded contact did not
 * carry, so an edit payload never turns "tab not visible" into "collection
 * empty" (R4-03).
 *
 * The read sanitizer deletes an unreadable tab's keys, and the form normalizer
 * then synthesizes blank rows for them; saving that draft would clear rows the
 * user never saw. A key that was absent from the source record is therefore left
 * out of the payload — the server keeps its stored value.
 */
export function stripAbsentContactCollections<T extends Record<string, unknown>>(
  payload: T,
  source: Record<string, unknown> | null | undefined,
): T {
  if (!source) return payload;
  const next: Record<string, unknown> = { ...payload };
  for (const keys of Object.values(CONTACT_TAB_COLLECTION_KEYS)) {
    const collection = String(keys[0]);
    if (Array.isArray(source[collection])) continue;
    for (const key of keys) {
      delete next[String(key)];
    }
  }
  return next as T;
}
