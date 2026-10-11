import { like, and } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";

export async function runMigration065(): Promise<void> {
  console.log("Clearing legacy Accounting setup config from objects table...");
  const db = getDb();

  const result = await db
    .delete(schema.objects)
    .where(and(like(schema.objects.key, "%::accounting_settings")))
    .returning({ key: schema.objects.key });

  console.log(`Deleted ${result.length} legacy Accounting setup objects.`);
}
