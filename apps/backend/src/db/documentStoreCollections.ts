import { applyTitleCaseRecursive, parseTenantScopedStorageKey } from "@mms/shared";
import { eq, sql } from "drizzle-orm";
import { getRequestTenant } from "../lib/tenantContext.js";
import { withTenant } from "./tenant-context.js";
import { RELATIONAL_REPLACE_MAPPING } from "./relationalReplaceMapping.js";
import * as schema from "./schema.js";
import { getQueryRows, resolveCollectionStorageName } from "./documentStoreKeys.js";
import { logger } from "../lib/logger.js";

export async function getCollection(name: string): Promise<unknown[] | null> {
  try {
    const storageName = resolveCollectionStorageName(name);
    const tenant = getRequestTenant();
    return await withTenant(
      tenant,
      async (tx) => {
        const rows = await tx
          .select({ data: schema.collections.data })
          .from(schema.collections)
          .where(eq(schema.collections.name, storageName))
          .limit(1);
        const row = rows[0];
        if (!row) return null;
        return row.data;
      },
      { allowGlobal: !tenant },
    );
  } catch (error) {
    logger.error({ name, err: error }, "Error getting collection");
    throw error;
  }
}

export async function getCollectionForUpdate(name: string): Promise<unknown[] | null> {
  try {
    const storageName = resolveCollectionStorageName(name);
    const tenant = getRequestTenant();
    return await withTenant(
      tenant,
      async (tx) => {
        await tx
          .insert(schema.collections)
          .values({ name: storageName, data: [] })
          .onConflictDoNothing();
        const result = await tx.execute(sql`
        SELECT data
        FROM collections
        WHERE name = ${storageName}
        FOR UPDATE
      `);
        const row = getQueryRows<{ data: unknown[] }>(result)[0];
        return row?.data ?? null;
      },
      { allowGlobal: !tenant },
    );
  } catch (error) {
    logger.error({ name, err: error }, "Error locking collection");
    throw error;
  }
}

export type SaveCollectionOptions = {
  /**
   * Admin sync/restore only. When true, wipe+replace mirrored relational tables
   * for REST-migrated collection keys. Ordinary JSON document writes must leave
   * this unset so client collection POSTs cannot wipe table-backed rows.
   */
  mirrorRelationalReplace?: boolean;
};

export async function saveCollection(
  name: string,
  data: unknown[],
  options: SaveCollectionOptions = {},
): Promise<void> {
  try {
    const storageName = resolveCollectionStorageName(name);
    const processedData = applyTitleCaseRecursive(data) as unknown[];
    const tenant = getRequestTenant();

    await withTenant(
      tenant,
      async (tx) => {
        await tx
          .insert(schema.collections)
          .values({ name: storageName, data: processedData })
          .onConflictDoUpdate({
            target: schema.collections.name,
            set: { data: processedData },
          });

        if (options.mirrorRelationalReplace) {
          const parsed = parseTenantScopedStorageKey(storageName);
          if (parsed) {
            const mapping = RELATIONAL_REPLACE_MAPPING[parsed.logicalKey];
            if (mapping) {
              const repoModule = await import(mapping.importPath);
              const replaceFn = repoModule[mapping.fnName];
              if (typeof replaceFn !== "function") {
                throw new Error(
                  `Relational replace helper "${mapping.fnName}" missing for collection "${parsed.logicalKey}"`,
                );
              }
              // Execute the relational replace mapping directly in this tx/pool context.
              await replaceFn(parsed.subdomain, processedData);
            }
          }
        }
      },
      { allowGlobal: !tenant },
    );

    if (tenant) {
      const { broadcastTenantUpdate } = await import("../lib/livePush.js");
      broadcastTenantUpdate(tenant, "collection", name);
    }
  } catch (error) {
    // Log only a safe message — the raw error/row payload must not reach logs (PII).
    logger.error(
      { name, err: error instanceof Error ? error.message : String(error) },
      "Error saving collection",
    );
    throw error;
  }
}

/** Deletes a tenant-scoped collection by logical key (JSON document store only). */
export async function deleteCollection(name: string): Promise<void> {
  const storageName = resolveCollectionStorageName(name);
  const tenant = getRequestTenant();
  await withTenant(
    tenant,
    async (tx) => {
      await tx.delete(schema.collections).where(eq(schema.collections.name, storageName));
    },
    { allowGlobal: !tenant },
  );

  if (tenant) {
    const { broadcastTenantUpdate } = await import("../lib/livePush.js");
    broadcastTenantUpdate(tenant, "collection", name);
  }
}
