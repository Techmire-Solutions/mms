import { parseTenantScopedStorageKey } from "@mms/shared";
import { deleteCollectionByStorageName, listCollectionStorageNames } from "../database.js";

const OVERDUE_OBLIGATIONS_COLLECTION = "overdue_obligations";

/**
 * Removes retired `overdue_obligations` document collections from all tenants.
 */
export async function runMigration034(): Promise<void> {
  const names = await listCollectionStorageNames();
  let changed = false;

  for (const name of names) {
    const parsed = parseTenantScopedStorageKey(name);
    const isLegacyUnscoped = name === OVERDUE_OBLIGATIONS_COLLECTION;
    const isScoped = parsed !== null && parsed.logicalKey === OVERDUE_OBLIGATIONS_COLLECTION;
    if (!isLegacyUnscoped && !isScoped) continue;
    await deleteCollectionByStorageName(name);
    changed = true;
  }

  if (changed) {
    console.log("[Migration 034] Purged retired overdue_obligations collections.");
  }
}
