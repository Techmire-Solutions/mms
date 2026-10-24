/**
 * Migration 079: Delete the legacy 'branding' key from the objects store for
 * every workspace, now that the data lives in typed workspaces columns.
 *
 * Only runs after migration 078 has completed successfully.  Idempotent.
 */
import { like } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";

export async function runMigration079(): Promise<void> {
  const db = getDb();
  const deleted = await db
    .delete(schema.objects)
    .where(like(schema.objects.key, "%::branding"))
    .returning({ key: schema.objects.key });

  if (deleted.length > 0) {
    console.log(
      `[079] Cleared ${deleted.length} legacy branding objects:`,
      deleted.map((r) => r.key),
    );
  }
}
