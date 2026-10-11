import { like, and } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";

export async function runMigration067(): Promise<void> {
  console.log("Clearing legacy Examinations setup config from objects table...");
  const db = getDb();

  const result = await db
    .delete(schema.objects)
    .where(and(like(schema.objects.key, "%::examinations_settings")))
    .returning({ key: schema.objects.key });

  console.log(`Deleted ${result.length} legacy Examinations setup objects.`);
}
