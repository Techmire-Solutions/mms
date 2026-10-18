/**
 * MMS Soft-Delete System shared types and contracts (docs/soft-delete.md §2.1).
 * Single source of truth for soft-delete metadata types across frontend and backend.
 */

export const SOFT_DELETE_KEYS = [
  "deletedAt",
  "deletedBy",
  "deletionReason",
  "restoredAt",
  "restoredBy",
  "deletedWithCascade",
] as const;

export type SoftDeleteKey = (typeof SOFT_DELETE_KEYS)[number];

/** Visibility filter for soft-delete queries (active rows, archived/deleted rows, or all rows). */
export type SoftDeleteListFilter = "active" | "deleted" | "all";

/** Metadata fields representing soft-delete state across all entity records. */
export interface SoftDeleteFields {
  deletedAt?: Date | string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
  restoredAt?: Date | string | null;
  restoredBy?: string | null;
  deletedWithCascade?: boolean | null;
}

/** Serialized soft-delete metadata fields in JSON contract responses. */
export interface SerializedSoftDeleteFields {
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  restoredAt?: string;
  restoredBy?: string;
  deletedWithCascade?: boolean;
}

/** Serialized audit timestamp and actor fields in JSON contract responses. */
export interface SerializedAuditFields {
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

/** Complete contract audit mixin combining soft-delete and timestamp/actor metadata. */
export interface SerializedEntityAuditFields
  extends SerializedSoftDeleteFields, SerializedAuditFields {}

/** Soft-delete audit payload provided by caller when archiving a record. */
export interface SoftDeleteAuditPayload {
  deletedBy?: string | null;
  deletionReason?: string | null;
}

/** Soft-restore audit payload provided by caller when restoring a record. */
export interface SoftRestoreAuditPayload {
  restoredBy?: string | null;
}

/** Check whether a generic entity record with soft-delete metadata is archived. */
export function isEntityDeleted<T extends { deletedAt?: unknown }>(
  record: T | null | undefined,
): boolean {
  if (!record) return false;
  return Boolean(record.deletedAt);
}

/** Filter active entities from a list. */
export function filterActiveEntities<T extends { deletedAt?: unknown }>(
  records: readonly T[],
): T[] {
  return records.filter((r) => !isEntityDeleted(r));
}

/** Reusable soft-delete column database field names mapping. */
export const softDeleteColumnNames = {
  deletedAt: "deleted_at",
  deletedBy: "deleted_by",
  deletionReason: "deletion_reason",
  restoredAt: "restored_at",
  restoredBy: "restored_by",
  deletedWithCascade: "deleted_with_cascade",
} as const;

/** Reusable soft-delete column names mapping alias matching Drizzle mixin identifier. */
export const softDeleteColumns = softDeleteColumnNames;

/** Reusable soft-delete columns type interface. */
export type SoftDeleteColumns = SoftDeleteFields;
