import { applyTitleCaseRecursive } from "@mms/shared";
import { eq } from "drizzle-orm";
import { getRequestTenant } from "../lib/tenantContext.js";
import { withTenant } from "./tenant-context.js";
import * as schema from "./schema.js";
import { resolveObjectStorageKey } from "./documentStoreKeys.js";
import { deleteObjectByStorageKey } from "./documentStoreAdmin.js";
import { logger } from "../lib/logger.js";

export async function getObject(key: string): Promise<unknown | null> {
  try {
    const storageKey = resolveObjectStorageKey(key);
    const tenant = getRequestTenant();
    return await withTenant(
      tenant,
      async (tx) => {
        const rows = await tx
          .select({ data: schema.objects.data })
          .from(schema.objects)
          .where(eq(schema.objects.key, storageKey))
          .limit(1);
        const row = rows[0];
        if (!row) return null;
        return row.data;
      },
      { allowGlobal: !tenant },
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
      { allowGlobal: !tenant },
    );

    if (tenant) {
      const { broadcastTenantUpdate } = await import("../lib/livePush.js");
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
    const { broadcastTenantUpdate } = await import("../lib/livePush.js");
    broadcastTenantUpdate(tenant, "object", key);
  }
}
