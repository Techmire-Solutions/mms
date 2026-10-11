import type { Contact } from "./contactTypes.js";

/** Soft-delete metadata must only be set by dedicated soft-delete helpers. */
export const CLIENT_SOFT_DELETE_KEYS = [
  "deletedAt",
  "deletedBy",
  "deletionReason",
  "restoredAt",
  "restoredBy",
  "deletedWithCascade",
] as const;

/** Backwards-compatible alias for contact-specific imports. */
export const CONTACT_CLIENT_SOFT_DELETE_KEYS = CLIENT_SOFT_DELETE_KEYS;

/** Whether a contact is soft-deleted (soft-delete.md §1). */
export function isContactDeleted(contact?: Contact | null): boolean {
  return Boolean(contact?.deletedAt);
}

/** Active directory rows — excludes soft-deleted records from Work by default. */
export function filterActiveContacts(contacts?: Contact[] | null): Contact[] {
  if (!Array.isArray(contacts)) return [];
  return contacts.filter(
    (contact): contact is Contact => Boolean(contact) && !isContactDeleted(contact),
  );
}

/** Strip client-supplied soft-delete and restore fields from a write payload. */
export function stripClientSoftDeleteFields<T>(record: T): T {
  if (!record || typeof record !== "object") {
    return record;
  }
  const next = { ...(record as Record<string, unknown>) };
  for (const key of CLIENT_SOFT_DELETE_KEYS) {
    delete next[key];
  }
  return next as T;
}

/** Backwards-compatible alias for contact-specific imports. */
export const stripContactClientSoftDeleteFields = stripClientSoftDeleteFields;

export { isEntityDeleted, filterActiveEntities } from "./softDelete.js";
