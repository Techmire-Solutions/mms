/**
 * @file systemMetadata.ts
 * @description Invariant list and filter for internal system metadata fields.
 *
 * Enforces the Field Whitelist requirement: exports and imports must only expose
 * human-readable form fields and strip internal identifiers and timestamps.
 */

export const SYSTEM_METADATA_KEYS: ReadonlySet<string> = new Set([
  "id",
  "_id",
  "uuid",
  "tenant",
  "_tenant",
  "tenantId",
  "tenant_id",
  "createdAt",
  "created_at",
  "createdDate",
  "created_date",
  "updatedAt",
  "updated_at",
  "updatedDate",
  "updated_date",
  "deletedAt",
  "deleted_at",
  "deletedDate",
  "deleted_date",
  "isDeleted",
  "is_deleted",
  "createdBy",
  "created_by",
  "updatedBy",
  "updated_by",
  "deletedBy",
  "deleted_by",
  "version",
  "__v",
  "_rev",
  "rev",
  "syncStatus",
  "sync_status",
  "shardedHash",
  "sharded_hash",
  "hashChain",
  "hash_chain",
]);

const NORMALIZED_SYSTEM_KEYS: ReadonlySet<string> = new Set(
  Array.from(SYSTEM_METADATA_KEYS).map((k) => k.toLowerCase().replace(/[\s_-]+/g, "")),
);

/**
 * Returns true if the given key represents internal system metadata.
 */
export function isSystemMetadataKey(key: string): boolean {
  if (!key) return false;
  if (SYSTEM_METADATA_KEYS.has(key)) return true;
  const normalized = key
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return NORMALIZED_SYSTEM_KEYS.has(normalized);
}

/**
 * Filter out any fields matching internal system metadata keys.
 */
export function filterNonMetadataKeys<T extends { key: string }>(fields: readonly T[]): T[] {
  return fields.filter((f) => !isSystemMetadataKey(f.key));
}

/**
 * Filter out any columns whose id or label matches internal system metadata keys.
 */
export function filterNonMetadataColumns<T extends { id: string; label?: string }>(
  columns: readonly T[],
): T[] {
  return columns.filter(
    (c) => !isSystemMetadataKey(c.id) && (!c.label || !isSystemMetadataKey(c.label)),
  );
}
