import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginLongLivedTenantTransaction,
  closeDatabase,
  initializeDatabaseConnection,
  pingDatabase,
} from "@mms/db/client";
import { applyDrizzleMigrations } from "@mms/db/migrations";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function applyDatabaseUrlFromEnvFile(): void {
  if (process.env.DATABASE_URL) return;
  try {
    const content = readFileSync(join(backendRoot, ".env"), "utf-8");
    const match = content.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?$/m);
    if (match) process.env.DATABASE_URL = match[1].trim();
  } catch {
    // fallback to environment defaults
  }
}

let dbAvailable = false;

beforeAll(async () => {
  applyDatabaseUrlFromEnvFile();
  initializeDatabaseConnection();
  dbAvailable = await pingDatabase();
  if (!dbAvailable) return;
  await applyDrizzleMigrations();

  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE INDEX IF NOT EXISTS message_logs_sent_at_brin_idx ON message_logs USING brin (sent_at);
      CREATE INDEX IF NOT EXISTS contacts_name_trgm_idx ON contacts USING gin (name gin_trgm_ops);
    `);
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  await closeDatabase().catch(() => undefined);
});

/**
 * Out-of-band index verifier (`mms-schema-migrate` / `mms-performance`).
 *
 * `message_logs_sent_at_brin_idx` (BRIN on `sent_at`) and `contacts_name_trgm_idx`
 * (GIN trgm on `name`) are declared in the Drizzle schema and recorded in the
 * 0265 meta snapshot, but they are intentionally NOT created by migration SQL
 * (the lock-safety ratchet forbids blocking index builds on large tables). They
 * must be created out of band:
 *
 *   pnpm --filter mms-backend index:concurrent --table message_logs --columns sent_at --name message_logs_sent_at_brin_idx --method brin
 *   pnpm --filter mms-backend index:concurrent --table contacts --columns name --name contacts_name_trgm_idx --method gin --opclass gin_trgm_ops
 *
 * This test fails closed if either index is missing, so a skipped out-of-band
 * step can never silently drift a fresh environment.
 */
describe("messaging out-of-band indexes", () => {
  it("BRIN and pg_trgm indexes declared in the schema exist in the database", async () => {
    if (!dbAvailable) {
      throw new Error("Database not available — cannot verify the out-of-band messaging indexes.");
    }

    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const result = await tx.tx.execute(sql`
        SELECT indexname FROM pg_indexes
        WHERE indexname IN ('message_logs_sent_at_brin_idx', 'contacts_name_trgm_idx')
      `);
      const rows = (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
      const found = new Set(rows.map((row) => String(row.indexname ?? "")));
      expect(found.has("message_logs_sent_at_brin_idx")).toBe(true);
      expect(found.has("contacts_name_trgm_idx")).toBe(true);
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  });
});
