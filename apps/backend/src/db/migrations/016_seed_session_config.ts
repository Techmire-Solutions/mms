import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
} from "@mms/shared";
import { getMinimalCollectionsForSeed } from "../minimalSeeds.js";
import {
  getCollectionByStorageName,
  listCollectionStorageNames,
  saveCollection,
} from "../database.js";

const SESSION_CONFIG_COLLECTIONS = ["sessionStatuses", "sessionTypes"] as const;

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

async function seedSessionConfigForPrefix(
  prefix: string,
  collections: Record<string, unknown[]>,
): Promise<boolean> {
  let changed = false;

  for (const key of SESSION_CONFIG_COLLECTIONS) {
    const storageName = prefix ? `${prefix}${key}` : key;
    const existing = await getCollectionByStorageName(storageName);
    if (Array.isArray(existing) && existing.length > 0) continue;
    await saveCollection(storageName, collections[key] ?? []);
    changed = true;
  }

  return changed;
}

/**
 * Backfills database-owned Sessions setup data for existing PostgreSQL tenants.
 */
export async function runMigration016(): Promise<void> {
  const [collections, subdomains] = await Promise.all([
    getMinimalCollectionsForSeed(),
    discoverTenantSubdomains(),
  ]);

  let changed = false;
  if (subdomains.size === 0) {
    changed = await seedSessionConfigForPrefix("", collections);
  } else {
    for (const subdomain of subdomains) {
      const didChange = await seedSessionConfigForPrefix(
        tenantCollectionKey(subdomain, ""),
        collections,
      );
      changed = changed || didChange;
    }
  }

  if (changed) {
    console.log("[Migration 016] Seeded database-owned session configuration defaults.");
  }
}
