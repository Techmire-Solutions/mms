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

const CONTACT_CONFIG_COLLECTIONS = [
  "genders",
  "socialPlatforms",
  "relationships",
  "phoneLabels",
  "emailLabels",
  "addressLabels",
  "countryCodes",
] as const;

const CONTACT_CONFIG_OBJECTS = ["socialPlaceholders"] as const;

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

async function seedContactConfigForPrefix(
  prefix: string,
  collections: Record<string, unknown[]>,
  objects: Record<string, unknown>,
): Promise<boolean> {
  let changed = false;

  for (const key of CONTACT_CONFIG_COLLECTIONS) {
    const storageName = prefix ? `${prefix}${key}` : key;
    const existing = await getCollectionByStorageName(storageName);
    if (Array.isArray(existing) && existing.length > 0) continue;
    await saveCollection(storageName, collections[key] ?? []);
    changed = true;
  }

  for (const key of CONTACT_CONFIG_OBJECTS) {
    const storageKey = prefix ? `${prefix}${key}` : key;
    const existing = await getObjectByStorageKey(storageKey);
    if (existing !== null && existing !== undefined) continue;
    await saveObject(storageKey, objects[key] ?? {});
    changed = true;
  }

  return changed;
}

/**
 * Backfills database-owned Contact setup data for existing PostgreSQL tenants.
 */
export async function runMigration013(): Promise<void> {
  const [collections, objects, subdomains] = await Promise.all([
    getMinimalCollectionsForSeed(),
    Promise.resolve(getMinimalObjects()),
    discoverTenantSubdomains(),
  ]);

  let changed = false;
  if (subdomains.size === 0) {
    changed = await seedContactConfigForPrefix("", collections, objects);
  } else {
    for (const subdomain of subdomains) {
      const didChange = await seedContactConfigForPrefix(
        tenantCollectionKey(subdomain, ""),
        collections,
        objects,
      );
      changed = changed || didChange;
    }
  }

  if (changed) {
    console.log("[Migration 013] Seeded database-owned contact configuration defaults.");
  }
}
