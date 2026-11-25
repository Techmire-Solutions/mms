import { RELATIONAL_REPLACE_MAPPING } from "./relationalReplaceMappingEntries.js";

export type { RelationalCollectionMapping } from "./relationalReplaceMappingEntries.js";
export { RELATIONAL_REPLACE_MAPPING } from "./relationalReplaceMappingEntries.js";

/**
 * Stable collection restore order for FK-safe admin backup restore.
 * Lower priority runs first; unmapped collections default to 100. Contacts must precede
 * users because `tenant_users.contact_id` is an FK with ON DELETE SET NULL — replacing
 * contacts after users would null out restored contact links.
 */
export function sortCollectionNamesForRestore(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const priorityA = RELATIONAL_REPLACE_MAPPING[a]?.priority ?? 100;
    const priorityB = RELATIONAL_REPLACE_MAPPING[b]?.priority ?? 100;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.localeCompare(b);
  });
}

/** Logical keys included in workspace backup snapshots (excludes audit trail). */
export function listBackupSnapshotCollectionKeys(): string[] {
  return Object.entries(RELATIONAL_REPLACE_MAPPING)
    .filter(([, mapping]) => Boolean(mapping.snapshotFnName))
    .map(([key]) => key);
}

/**
 * Ensures every snapshotted relational collection is present on a restore payload.
 * Missing keys become `[]` so stale rows are wiped instead of left behind.
 *
 * Only expands when `users` is present — that marks a full workspace backup restore.
 * Partial payloads without users are left unchanged so they cannot wipe the tenant.
 */
export function withCompleteRelationalRestoreCollections(
  collections: Record<string, unknown[]> | undefined,
): Record<string, unknown[]> {
  const next: Record<string, unknown[]> = { ...(collections ?? {}) };
  if (!Array.isArray(next.users)) {
    return next;
  }
  for (const key of listBackupSnapshotCollectionKeys()) {
    if (!(key in next) || !Array.isArray(next[key])) {
      next[key] = [];
    }
  }
  return next;
}
