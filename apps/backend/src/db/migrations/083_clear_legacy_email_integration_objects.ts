import { like, or } from "drizzle-orm";
import { getDb } from "@mms/db/client";
import * as schema from "@mms/db/schema";

export async function runMigration083(): Promise<void> {
  const db = getDb();
  await db
    .delete(schema.objects)
    .where(
      or(
        like(schema.objects.key, "%::email_integration"),
        like(schema.objects.key, "%::email_integration_secrets"),
      ),
    );
}
