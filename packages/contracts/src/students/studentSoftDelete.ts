import {
  CLIENT_SOFT_DELETE_KEYS,
  stripClientSoftDeleteFields,
} from "../contacts/contactSoftDelete.js";
import { filterActiveStudents, isStudentDeleted } from "./studentTypes.js";

/** Client-supplied soft-delete keys for student mutations. */
export const STUDENT_CLIENT_SOFT_DELETE_KEYS = CLIENT_SOFT_DELETE_KEYS;

/**
 * Audit attribution and timestamps the server owns on student writes.
 *
 * A client-supplied value here forges the row's provenance: `createdAt` is the insert value
 * (`repositoryMappers.mapAuditToInsert`), feeds audit lookups, and is the fallback bucket for the
 * `COALESCE(registeredDate, createdAt)` metrics. Attribution is stamped from the session.
 */
export const STUDENT_SERVER_OWNED_AUDIT_KEYS = [
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
] as const;

/** Strip server-owned audit attribution/timestamps from a student create/update payload. */
export function stripStudentServerOwnedAuditFields<T>(record: T): T {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  const next = { ...(record as Record<string, unknown>) };
  for (const key of STUDENT_SERVER_OWNED_AUDIT_KEYS) delete next[key];
  return next as T;
}

/** Strip client soft-delete metadata from student create/update payloads. */
export function stripStudentClientSoftDeleteFields<T>(record: T): T {
  const next = stripClientSoftDeleteFields(record);
  if (next && typeof next === "object") {
    delete (next as Record<string, unknown>).deleted;
  }
  return next;
}

export { stripClientSoftDeleteFields } from "../contacts/contactSoftDelete.js";

export { isEntityDeleted, filterActiveEntities } from "../core/softDelete.js";

export { filterActiveStudents, isStudentDeleted };
