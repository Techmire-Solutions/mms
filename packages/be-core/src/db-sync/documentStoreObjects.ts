import { applyTitleCaseRecursive } from "@mms/contracts";
import { eq } from "drizzle-orm";
import { getRequestTenant } from "../http/index.js";
import { withTenant } from "@mms/db/context";
import { inGlobalDocumentStoreScope } from "./documentStoreScope.js";
import * as schema from "@mms/db/schema";
import { resolveObjectStorageKey } from "./documentStoreKeys.js";
import { deleteObjectByStorageKey } from "./documentStoreAdmin.js";
import { logger } from "../logger/index.js";

export async function getObject(
  key: string,
  options: { forUpdate?: boolean } = {},
): Promise<unknown | null> {
  try {
    const storageKey = resolveObjectStorageKey(key);
    const tenant = getRequestTenant();
    return await withTenant(
      tenant,
      async (tx) => {
        const query = tx
          .select({ data: schema.objects.data })
          .from(schema.objects)
          .where(eq(schema.objects.key, storageKey))
          .limit(1);
        // Row lock for read-modify-write callers. It only has an effect when
        // this call joins an already-active `withTenant` transaction.
        const rows = options.forUpdate ? await query.for("update") : await query;
        const row = rows[0];
        if (!row) return null;
        return row.data;
      },
      { allowGlobal: !tenant && inGlobalDocumentStoreScope() },
    );
  } catch (error) {
    logger.error({ key, err: error }, "Error getting object");
    throw error;
  }
}

export async function saveObject(key: string, data: unknown): Promise<void> {
  try {
    const storageKey = resolveObjectStorageKey(key);
    const tenant = getRequestTenant();
    const processedData = applyTitleCaseRecursive(data);

    await withTenant(
      tenant,
      async (tx) => {
        await tx
          .insert(schema.objects)
          .values({ key: storageKey, data: processedData })
          .onConflictDoUpdate({
            target: schema.objects.key,
            set: { data: processedData },
          });
      },
      { allowGlobal: !tenant && inGlobalDocumentStoreScope() },
    );

    if (tenant) {
      const { broadcastTenantUpdate } = await import("../realtime/index.js");
      broadcastTenantUpdate(tenant, "object", key);
    }
  } catch (error) {
    logger.error({ key, err: error }, "Error saving object");
    throw error;
  }
}

/** Deletes a tenant-scoped object by logical key. */
export async function deleteObject(key: string): Promise<void> {
  const storageKey = resolveObjectStorageKey(key);
  await deleteObjectByStorageKey(storageKey);
  const tenant = getRequestTenant();
  if (tenant) {
    const { broadcastTenantUpdate } = await import("../realtime/index.js");
    broadcastTenantUpdate(tenant, "object", key);
  }
}
