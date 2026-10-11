/**
 * Clears legacy document-store `contacts` arrays after typed-table migration (020).
 * Entity rows are REST-only; residual JSON collections are a dual-store hazard.
 * Skips delete when typed table is empty but legacy rows still exist (avoids data loss).
 */
import { parseTenantScopedStorageKey } from "@mms/shared";
import {
  listCollectionStorageNames,
  deleteCollectionByStorageName,
  getCollectionByStorageName,
} from "../database.js";
import { countContactsByWorkspace } from "../repositories/contactRepository.js";

export async function runMigration038(): Promise<void> {
  const names = await listCollectionStorageNames();
  let removed = 0;
  let skipped = 0;

  for (const name of names) {
    const parsed = parseTenantScopedStorageKey(name);
    const isTenantContacts = parsed?.logicalKey === "contacts";
    const isLegacyApexContacts = name === "contacts";
    if (!isTenantContacts && !isLegacyApexContacts) continue;

    const legacy = await getCollectionByStorageName(name);
    const legacyCount = Array.isArray(legacy) ? legacy.length : 0;

    if (parsed?.subdomain) {
      const typedCount = await countContactsByWorkspace(parsed.subdomain, { deleted: "all" });
      if (typedCount === 0 && legacyCount > 0) {
        skipped += 1;
        console.warn(
          `[Migration 038] Skipping "${name}": typed contacts empty but legacy has ${legacyCount} rows.`,
        );
        continue;
      }
    } else if (isLegacyApexContacts && legacyCount > 0) {
      // Apex-scoped legacy key with no tenant subdomain — leave for manual review.
      skipped += 1;
      console.warn(
        `[Migration 038] Skipping apex "${name}": ${legacyCount} legacy rows without tenant scope.`,
      );
      continue;
    }

    await deleteCollectionByStorageName(name);
    removed += 1;
    console.log(`[Migration 038] Deleted legacy document-store contacts key "${name}".`);
  }

  if (removed === 0 && skipped === 0) {
    console.log("[Migration 038] No legacy contacts document-store keys to clear.");
  } else if (skipped > 0) {
    console.log(`[Migration 038] Removed ${removed} key(s); skipped ${skipped} unsafe key(s).`);
  }
}
