/**
 * Replaces persisted Contacts `countryCodes` collections that still include
 * retired seed countries with the curated {@link COUNTRY_CODES} list.
 */
import {
  curatedContactCountryCodes,
  needsContactCountryCodesCurate,
  parseTenantScopedStorageKey,
} from "@mms/shared";
import {
  getCollectionByStorageName,
  listCollectionStorageNames,
  saveCollection,
} from "../database.js";

function isCountryCodesStorageName(name: string): boolean {
  if (name === "countryCodes") return true;
  const parsed = parseTenantScopedStorageKey(name);
  return parsed?.logicalKey === "countryCodes";
}

function isCountryCodeEntry(value: unknown): value is { country: string; code: string } {
  if (!value || typeof value !== "object") return false;
  const entry = value as { country?: unknown; code?: unknown };
  return typeof entry.country === "string" && typeof entry.code === "string";
}

export async function runMigration039(): Promise<void> {
  const names = await listCollectionStorageNames();
  let updated = 0;

  for (const name of names) {
    if (!isCountryCodesStorageName(name)) continue;

    const existing = await getCollectionByStorageName(name);
    if (!Array.isArray(existing) || existing.length === 0) continue;

    const entries = existing.filter(isCountryCodeEntry);
    if (!needsContactCountryCodesCurate(entries)) continue;

    await saveCollection(name, curatedContactCountryCodes());
    updated += 1;
    console.log(`[Migration 039] Curated countryCodes for "${name}".`);
  }

  if (updated === 0) {
    console.log("[Migration 039] No countryCodes collections needed curation.");
  } else {
    console.log(`[Migration 039] Curated ${updated} countryCodes collection(s).`);
  }
}
