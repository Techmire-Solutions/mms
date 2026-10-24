/**
 * Migration 081: Delete the legacy 'global_settings' and 'platform_settings' keys from the objects store
 * for every workspace, now that the data lives in typed workspaces columns.
 *
 * Only runs after migration 080 has completed successfully. Idempotent.
 */
import { or, like } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";

export async function runMigration081(): Promise<void> {
  const db = getDb();
  const deleted = await db
    .delete(schema.objects)
    .where(
      or(
        like(schema.objects.key, "%::global_settings"),
        like(schema.objects.key, "%::platform_settings"),
      ),
    )
    .returning({ key: schema.objects.key });

  if (deleted.length > 0) {
    console.log(
      `[081] Cleared ${deleted.length} legacy global/platform settings objects:`,
      deleted.map((r) => r.key),
    );
  }
}
