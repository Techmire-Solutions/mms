import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
} from "@mms/shared";
import { getMinimalCollectionsForSeed, getMinimalObjects } from "../minimalSeeds.js";
import {
  getCollectionByStorageName,
  getObjectByStorageKey,
  listCollectionStorageNames,
  saveCollection,
  saveObject,
} from "../database.js";

const STUDENT_CONFIG_COLLECTIONS = [] as const;

const STUDENT_CONFIG_OBJECTS = ["students_settings"] as const;

function mergeStudentSettingsDefaults(existing: unknown, defaults: unknown): unknown {
  if (!existing || typeof existing !== "object" || !defaults || typeof defaults !== "object") {
    return defaults;
  }
  const current = existing as Record<string, unknown>;
  const fallback = defaults as Record<string, unknown>;
  return {
    ...fallback,
    ...current,
    fields: {
      ...((fallback.fields as Record<string, unknown> | undefined) ?? {}),
      ...((current.fields as Record<string, unknown> | undefined) ?? {}),
    },
    customFields: Array.isArray(current.customFields)
      ? current.customFields
      : fallback.customFields,
    fieldOrder: Array.isArray(current.fieldOrder) ? current.fieldOrder : fallback.fieldOrder,
  };
}

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

async function seedStudentConfigForPrefix(
  prefix: string,
  collections: Record<string, unknown[]>,
  objects: Record<string, unknown>,
): Promise<boolean> {
  let changed = false;

  for (const key of STUDENT_CONFIG_COLLECTIONS) {
    const storageName = prefix ? `${prefix}${key}` : key;
    const existing = await getCollectionByStorageName(storageName);
    if (Array.isArray(existing) && existing.length > 0) continue;
    await saveCollection(storageName, collections[key] ?? []);
    changed = true;
  }

  for (const key of STUDENT_CONFIG_OBJECTS) {
    const storageKey = prefix ? `${prefix}${key}` : key;
    const existing = await getObjectByStorageKey(storageKey);
    if (key === "students_settings" && existing !== null && existing !== undefined) {
      const merged = mergeStudentSettingsDefaults(existing, objects[key] ?? {});
      if (JSON.stringify(merged) === JSON.stringify(existing)) continue;
      await saveObject(storageKey, merged);
      changed = true;
      continue;
    }
    if (existing !== null && existing !== undefined) continue;
    await saveObject(storageKey, objects[key] ?? {});
    changed = true;
  }

  return changed;
}

/**
 * Backfills database-owned Students setup data for existing PostgreSQL tenants.
 */
export async function runMigration014(): Promise<void> {
  const [collections, objects, subdomains] = await Promise.all([
    getMinimalCollectionsForSeed(),
    Promise.resolve(getMinimalObjects()),
    discoverTenantSubdomains(),
  ]);

  let changed = false;
  if (subdomains.size === 0) {
    changed = await seedStudentConfigForPrefix("", collections, objects);
  } else {
    for (const subdomain of subdomains) {
      const didChange = await seedStudentConfigForPrefix(
        tenantCollectionKey(subdomain, ""),
        collections,
        objects,
      );
      changed = changed || didChange;
    }
  }

  if (changed) {
    console.log("[Migration 014] Seeded database-owned student configuration defaults.");
  }
}
