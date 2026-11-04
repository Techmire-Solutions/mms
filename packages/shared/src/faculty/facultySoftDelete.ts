import {
  CLIENT_SOFT_DELETE_KEYS,
  stripClientSoftDeleteFields,
} from "../contacts/contactSoftDelete.js";

/** Client-supplied soft-delete keys for faculty mutations. */
export const FACULTY_CLIENT_SOFT_DELETE_KEYS = CLIENT_SOFT_DELETE_KEYS;

/** Strip client soft-delete metadata from faculty create/update payloads. */
export function stripFacultyClientSoftDeleteFields<T>(record: T): T {
  const next = stripClientSoftDeleteFields(record);
  if (next && typeof next === "object") {
    delete (next as Record<string, unknown>).deleted;
  }
  return next;
}

/**
 * Audit attribution and timestamps the server owns on faculty writes.
 *
 * `mapAuditToInsert` writes these values straight into the row (`created_by` /
 * `updated_by` / `created_at`), so accepting them from a payload lets any writer
 * forge attribution and back-date a faculty record. Contacts and Students already
 * strip the same keys; this keeps Faculty at parity (`mms-data-layer` §5.9).
 */
export const FACULTY_SERVER_OWNED_AUDIT_KEYS = [
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
] as const;

/** Strip server-owned audit attribution/timestamps from a faculty write payload. */
export function stripFacultyServerOwnedAuditFields<T>(record: T): T {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  const next = { ...(record as Record<string, unknown>) };
  for (const key of FACULTY_SERVER_OWNED_AUDIT_KEYS) delete next[key];
  return next as T;
}

export { stripClientSoftDeleteFields } from "../contacts/contactSoftDelete.js";

export { isEntityDeleted, filterActiveEntities } from "../core/softDelete.js";

export { filterActiveFaculty, isFacultyDeleted } from "./facultyTypes.js";
