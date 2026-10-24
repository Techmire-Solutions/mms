import { like, and } from "drizzle-orm";
import { getDb } from "../dbClient.js";
import * as schema from "../schema.js";

export async function runMigration063(): Promise<void> {
  console.log("Clearing legacy Attendance setup config from objects table...");
  const db = getDb();

  const result = await db
    .delete(schema.objects)
    .where(and(like(schema.objects.key, "%::attendance_settings")))
    .returning({ key: schema.objects.key });

  console.log(`Deleted ${result.length} legacy Attendance setup objects.`);
}
