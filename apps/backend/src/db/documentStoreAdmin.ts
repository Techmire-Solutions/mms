import {
  WORKSPACES_COLLECTION,
  isBackupExcludedObjectKey,
  isServerOnlyObjectKey,
  parseTenantScopedStorageKey,
} from "@mms/shared";
import { eq } from "drizzle-orm";
import { getRequestTenant } from "../lib/tenantContext.js";
import { withTenant } from "./tenant-context.js";
import { inGlobalDocumentStoreScope } from "./documentStoreScope.js";
import * as schema from "./schema.js";
import { logger } from "../lib/logger.js";

export async function getAllData(): Promise<{
  collections: Record<string, unknown[]>;
  objects: Record<string, unknown>;
}> {
  try {
    const tenant = getRequestTenant();
    return await withTenant(
      tenant,
      async (tx) => {
        const collections: Record<string, unknown[]> = {};
        const colRows = await tx
          .select({
            name: schema.collections.name,
            data: schema.collections.data,
          })
          .from(schema.collections);
        for (const row of colRows) {
          if (row.name === WORKSPACES_COLLECTION) continue;
          const parsed = parseTenantScopedStorageKey(row.name);
          if (tenant) {
            if (!parsed || parsed.subdomain !== tenant) continue;
            collections[parsed.logicalKey] = row.data;
          } else if (!parsed) {
            collections[row.name] = row.data;
          }
        }

        const objects: Record<string, unknown> = {};
        const objRows = await tx
          .select({
            key: schema.objects.key,
            data: schema.objects.data,
          })
          .from(schema.objects);
        for (const row of objRows) {
          const parsed = parseTenantScopedStorageKey(row.key);
          const logicalKey = parsed?.logicalKey ?? row.key;
          if (isServerOnlyObjectKey(logicalKey)) continue;
          // platform_settings is platform-authoritative — never round-trip via backup.
          if (isBackupExcludedObjectKey(logicalKey)) continue;

          if (tenant) {
            if (!parsed || parsed.subdomain !== tenant) continue;
            objects[parsed.logicalKey] = row.data;
          } else if (!parsed) {
            objects[row.key] = row.data;
          }
        }

        return { collections, objects };
      },
      { allowGlobal: !tenant && inGlobalDocumentStoreScope() },
    );
  } catch (error) {
    logger.error({ err: error }, "Error retrieving all database data");
    throw error;
  }
}

/** Lists all collection storage names (including tenant-prefixed). */
export async function listCollectionStorageNames(): Promise<string[]> {
  const tenant = getRequestTenant();
  return withTenant(
    tenant,
    async (tx) => {
      const colRows = await tx.select({ name: schema.collections.name }).from(schema.collections);
      return colRows.map((row) => row.name);
    },
    { allowGlobal: !tenant && inGlobalDocumentStoreScope() },
  );
}

/** Reads a collection by exact storage name (no tenant prefixing). */
export async function getCollectionByStorageName(name: string): Promise<unknown[] | null> {
  const tenant = getRequestTenant();
  return withTenant(
    tenant,
    async (tx) => {
      const rows = await tx
        .select({ data: schema.collections.data })
        .from(schema.collections)
        .where(eq(schema.collections.name, name))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return row.data;
    },
    { allowGlobal: !tenant && inGlobalDocumentStoreScope() },
  );
}

/** Deletes a collection row by exact storage name. */
export async function deleteCollectionByStorageName(name: string): Promise<void> {
  const tenant = getRequestTenant();
  await withTenant(
    tenant,
    async (tx) => {
      await tx.delete(schema.collections).where(eq(schema.collections.name, name));
    },
    { allowGlobal: !tenant && inGlobalDocumentStoreScope() },
  );
}

/** Deletes an object row by exact storage key. */
export async function deleteObjectByStorageKey(key: string): Promise<void> {
  const tenant = getRequestTenant();
  await withTenant(
    tenant,
    async (tx) => {
      await tx.delete(schema.objects).where(eq(schema.objects.key, key));
    },
    { allowGlobal: !tenant && inGlobalDocumentStoreScope() },
  );
}

/** Lists all object storage keys (including tenant-prefixed). */
export async function listObjectStorageKeys(): Promise<string[]> {
  const tenant = getRequestTenant();
  return withTenant(
    tenant,
    async (tx) => {
      const objRows = await tx.select({ key: schema.objects.key }).from(schema.objects);
      return objRows.map((row) => row.key);
    },
    { allowGlobal: !tenant && inGlobalDocumentStoreScope() },
  );
}

/**
 * Lists the request tenant's object logical keys, mirroring the filters `getAllData`
 * applies to backup exports so restore can prune whatever the backup does not carry.
 */
export async function listTenantObjectLogicalKeys(): Promise<string[]> {
  const tenant = getRequestTenant();
  if (!tenant) return [];
  return withTenant(tenant, async (tx) => {
    const objRows = await tx.select({ key: schema.objects.key }).from(schema.objects);
    const logicalKeys: string[] = [];
    for (const row of objRows) {
      const parsed = parseTenantScopedStorageKey(row.key);
      if (!parsed || parsed.subdomain !== tenant) continue;
      if (isServerOnlyObjectKey(parsed.logicalKey)) continue;
      // Backup-excluded keys are not exported, so they must not be pruned on a
      // full restore either — the platform's current grants survive the wipe.
      if (isBackupExcludedObjectKey(parsed.logicalKey)) continue;
      logicalKeys.push(parsed.logicalKey);
    }
    return logicalKeys;
  });
}

/**
 * Lists the request tenant's collection logical keys (same scoping as `getAllData`).
 * Includes leftover document-store keys (legacy collections not on the write allowlist).
 */
export async function listTenantCollectionLogicalKeys(): Promise<string[]> {
  const tenant = getRequestTenant();
  if (!tenant) return [];
  return withTenant(tenant, async (tx) => {
    const colRows = await tx.select({ name: schema.collections.name }).from(schema.collections);
    const logicalKeys: string[] = [];
    for (const row of colRows) {
      if (row.name === WORKSPACES_COLLECTION) continue;
      const parsed = parseTenantScopedStorageKey(row.name);
      if (!parsed || parsed.subdomain !== tenant) continue;
      logicalKeys.push(parsed.logicalKey);
    }
    return logicalKeys;
  });
}

/** Reads an object by exact storage key (no tenant prefixing). */
export async function getObjectByStorageKey(key: string): Promise<unknown | null> {
  const tenant = getRequestTenant();
  return withTenant(
    tenant,
    async (tx) => {
      const rows = await tx
        .select({ data: schema.objects.data })
        .from(schema.objects)
        .where(eq(schema.objects.key, key))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return row.data;
    },
    { allowGlobal: !tenant && inGlobalDocumentStoreScope() },
  );
}
