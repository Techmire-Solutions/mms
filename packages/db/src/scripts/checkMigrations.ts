/**
 * Read-only migration status check (`db:check`).
 *
 * Prints the applied Drizzle journal entries, any pending migrations and the data-migration
 * ledger, plus a faculty-table sanity table. It never writes.
 *
 * Connection settings come from the process environment (`DATABASE_URL`, read by `@mms/db`'s
 * runtime config) — `packages/db` never parses `.env`; the app entry
 * (`apps/api/src/scripts/checkMigrations.ts`) loads the env files and then calls `main()`.
 *
 * Usage: pnpm --filter @mms/db run db:check
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, getPool, initializeDatabaseConnection } from "@mms/db/client";
import { resolveMigrationsFolder } from "@mms/db/migrations";

interface DrizzleMigrationRecord {
  id: number;
  hash: string;
  created_at: number;
}

interface DataMigrationRecord {
  id: string;
  applied_at: Date;
}

/** One entry of `migrations_drizzle/meta/_journal.json`. */
export interface DrizzleJournalEntry {
  tag: string;
  when: number;
}

/**
 * Journal entries that have no matching row in the applied set.
 *
 * Both sides are string-coerced on purpose: Drizzle records `created_at` as an epoch-ms
 * integer while the journal records `when`, and a driver may return either as a string.
 */
export function findUnappliedMigrations(
  journalEntries: readonly DrizzleJournalEntry[],
  applied: readonly Pick<DrizzleMigrationRecord, "created_at">[],
): DrizzleJournalEntry[] {
  const appliedWhen = new Set(applied.map((entry) => String(entry.created_at)));
  return journalEntries.filter((entry) => !appliedWhen.has(String(entry.when)));
}

export async function runCheckMigrations(): Promise<void> {
  initializeDatabaseConnection();
  const pool = getPool();
  try {
    console.log("--- Checking Drizzle Schema Migrations ---");
    const drizzleResult = await pool.query<DrizzleMigrationRecord>(
      "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC",
    );
    const appliedDrizzle = drizzleResult.rows;

    const migrationsFolder = resolveMigrationsFolder();
    const journalPath = join(migrationsFolder, "meta", "_journal.json");
    if (existsSync(journalPath)) {
      const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
        entries?: DrizzleJournalEntry[];
      };
      const entries = journal.entries ?? [];
      console.log(`Journal migrations count: ${entries.length}`);
      console.log(`Applied Drizzle migrations count: ${appliedDrizzle.length}`);

      const unapplied = findUnappliedMigrations(entries, appliedDrizzle);

      if (unapplied.length > 0) {
        console.warn(
          "⚠️ Pending Drizzle migrations:",
          unapplied.map((entry) => entry.tag),
        );
      } else {
        console.log(
          `✅ All ${entries.length} Drizzle migrations from journal are applied in database.`,
        );
      }
    } else {
      console.log(`Journal not found at ${journalPath}`);
    }

    console.log("\n--- Checking Data Migrations ---");
    const dataResult = await pool.query<DataMigrationRecord>(
      "SELECT id, applied_at FROM data_migrations ORDER BY id ASC",
    );
    console.log(`Applied data migrations count: ${dataResult.rows.length}`);
    const latestData = dataResult.rows.slice(-5);
    console.log(
      "Recent applied data migrations:",
      latestData.map((row) => row.id),
    );

    console.log("\n--- Checking Faculty Domain Tables & Columns ---");
    const tables = [
      "faculty_departments",
      "faculty_designations",
      "faculty_employments",
      "faculty",
      "faculty_employ_designations",
      "faculty_assignments",
    ];
    for (const table of tables) {
      const colRes = await pool.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
        [table],
      );
      const countRes = await pool.query<{ count: string }>(`SELECT count(*) FROM "${table}"`);
      const rowCount = countRes.rows[0]?.count ?? "0";
      console.log(`✓ Table "${table}": ${colRes.rows.length} columns, ${rowCount} rows`);
    }

    const sampleFaculty = await pool.query(`
      SELECT f.id, f.employment_id, fe.contact_id, fe.employee_id, f.profile_status, fe.status AS employment_status
      FROM faculty f
      LEFT JOIN faculty_employments fe ON fe.id = f.employment_id
      LIMIT 3
    `);
    console.log("\nSample faculty records:");
    console.table(sampleFaculty.rows);

    console.log("\n--- Migration Check Complete ---");
  } catch (error) {
    console.error("Failed to check migrations:", error);
  } finally {
    await closeDatabase();
  }
}

export async function main(): Promise<void> {
  try {
    await runCheckMigrations();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("checkMigrations.ts") ||
    process.argv[1].endsWith("checkMigrations.js") ||
    fileURLToPath(import.meta.url) === process.argv[1]);

if (isEntrypoint) {
  void main();
}
