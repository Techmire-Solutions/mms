import {
  DEFAULT_FACULTY_SETTINGS,
  WORKSPACES_COLLECTION,
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  tenantObjectKey,
  type Workspace,
} from "@mms/shared";
import {
  getCollectionByStorageName,
  getObjectByStorageKey,
  listCollectionStorageNames,
  listObjectStorageKeys,
  saveCollection,
  saveObject,
} from "../database.js";

const TEACHERS_COLLECTION = "teachers";
const TEACHERS_SETTINGS_KEY = "teachers_settings";

async function discoverTenantSubdomains(): Promise<Set<string>> {
  const subdomains = new Set<string>();
  const names = await listCollectionStorageNames();
  for (const name of names) {
    const parsed = parseTenantScopedStorageKey(name);
    if (parsed) subdomains.add(parsed.subdomain);
  }

  const workspaces = await getCollectionByStorageName(WORKSPACES_COLLECTION);
  if (Array.isArray(workspaces)) {
    for (const entry of workspaces) {
      const subdomain = (entry as Workspace).subdomain;
      if (subdomain) subdomains.add(subdomain);
    }
  }

  return subdomains;
}

/**
 * Initializes empty teacher storage and default settings without creating teacher records.
 * Idempotent - skips tenants that already have teacher records and settings.
 */
export async function runMigration004(): Promise<void> {
  const subdomains = await discoverTenantSubdomains();
  let changed = false;

  if (subdomains.size === 0) {
    const legacyTeachers = await getCollectionByStorageName(TEACHERS_COLLECTION);
    if (!Array.isArray(legacyTeachers) || legacyTeachers.length === 0) {
      await saveCollection(TEACHERS_COLLECTION, []);
      console.log("[Migration 004] Seeded empty teachers collection (legacy storage)");
      changed = true;
    }

    const objectKeys = await listObjectStorageKeys();
    if (!objectKeys.includes(TEACHERS_SETTINGS_KEY)) {
      await saveObject(TEACHERS_SETTINGS_KEY, DEFAULT_FACULTY_SETTINGS);
      changed = true;
    }

    if (changed) {
      console.log("[Migration 004] Teachers migration completed.");
    }
    return;
  }

  for (const subdomain of subdomains) {
    const teachersKey = tenantCollectionKey(subdomain, TEACHERS_COLLECTION);
    const existing = await getCollectionByStorageName(teachersKey);
    if (!Array.isArray(existing) || existing.length === 0) {
      await saveCollection(teachersKey, []);
      console.log(`[Migration 004] Seeded empty teachers collection for tenant "${subdomain}"`);
      changed = true;
    }

    const settingsKey = tenantObjectKey(subdomain, TEACHERS_SETTINGS_KEY);
    const settings = await getObjectByStorageKey(settingsKey);
    if (settings === null) {
      await saveObject(settingsKey, DEFAULT_FACULTY_SETTINGS);
      changed = true;
    }
  }

  if (changed) {
    console.log("[Migration 004] Teacher storage migration completed.");
  }
}
