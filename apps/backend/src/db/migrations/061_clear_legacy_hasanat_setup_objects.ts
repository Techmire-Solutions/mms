import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";
import { eq, or } from "drizzle-orm";
import { HASANAT_MODULE_MANIFEST, parseTenantScopedStorageKey } from "@mms/shared";

const SETTINGS_KEY = "hasanat_settings";

export async function runMigration061(): Promise<void> {
  console.log("Clearing legacy Hasanat setup objects...");
  const db = getDb();

  const rows = await db.select().from(schema.objects);
  const keysToDelete: string[] = [];

  for (const row of rows) {
    const parsed = parseTenantScopedStorageKey(row.key);
    if (!parsed) continue;

    if (
      parsed.logicalKey === SETTINGS_KEY ||
      parsed.logicalKey === HASANAT_MODULE_MANIFEST.distributionColumnPreferencesObjectKey ||
      parsed.logicalKey === HASANAT_MODULE_MANIFEST.redemptionColumnPreferencesObjectKey
    ) {
      keysToDelete.push(row.key);
    }
  }

  if (keysToDelete.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < keysToDelete.length; i += batchSize) {
      const batch = keysToDelete.slice(i, i + batchSize);
      await db.delete(schema.objects).where(or(...batch.map((k) => eq(schema.objects.key, k))));
    }
    console.log(`Deleted legacy Hasanat setup objects: ${keysToDelete.length} rows.`);
  } else {
    console.log("No keys to delete found.");
  }
}
