import { sql } from "drizzle-orm";
import { loadBackendEnv } from "../config/loadEnv.js";
import { activeDb, closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { logger } from "../lib/logger.js";
import { summarizeTimestampColumns, type NaiveTimestampColumn } from "./timestampAuditCore.js";

loadBackendEnv();

/**
 * Inventories `timestamp without time zone` columns before the per-table
 * timestamptz migration.
 *
 * This is deliberately read-only: it discovers columns from
 * `information_schema`, reports the database session timezone (the input that
 * decides whether `AT TIME ZONE 'UTC'` is correct), and shows estimated row
 * counts so the migration order can be planned. It changes no data.
 *
 *   pnpm --filter mms-backend audit:timestamps [-- --json]
 *
 * Run it against a disposable database for a baseline and against production
 * before scheduling any conversion; see `docs/timestamp-migration.md`.
 */
async function main(): Promise<void> {
  const json = process.argv.includes("--json");
  initializeDatabaseConnection();
  const db = activeDb();

  const tzResult = await db.execute(sql`SELECT current_setting('TimeZone') AS tz`);
  const timeZone = String(((tzResult.rows?.[0] ?? {}) as { tz?: string }).tz ?? "unknown");

  const columnResult = await db.execute(sql`
    SELECT c.table_name, c.column_name, c.is_nullable
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type = 'timestamp without time zone'
    ORDER BY c.table_name, c.column_name
  `);
  const columns = (columnResult.rows ?? []).map((row) => ({
    table_name: String(row.table_name ?? ""),
    column_name: String(row.column_name ?? ""),
    is_nullable: String(row.is_nullable ?? "NO"),
  }));

  const tenantResult = await db.execute(sql`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'workspace_subdomain'
  `);
  const tenantTables = new Set(
    (tenantResult.rows ?? []).map((row) => String(row.table_name ?? "")),
  );

  const estimateResult = await db.execute(sql`
    SELECT c.relname AS table_name, c.reltuples::bigint AS estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  `);
  const estimates = new Map<string, number | null>();
  for (const row of estimateResult.rows ?? []) {
    const value = Number(row.estimate);
    estimates.set(
      String(row.table_name ?? ""),
      Number.isFinite(value) && value >= 0 ? value : null,
    );
  }

  const inventory: NaiveTimestampColumn[] = columns.map((row) => ({
    table: row.table_name,
    column: row.column_name,
    nullable: row.is_nullable === "YES",
    scope: tenantTables.has(row.table_name) ? "tenant" : "global",
    estimatedRows: estimates.get(row.table_name) ?? null,
  }));
  const summary = summarizeTimestampColumns(inventory);

  if (json) {
    console.log(JSON.stringify({ timeZone, ...summary }, null, 2));
  } else {
    console.log(`[audit:timestamps] session TimeZone: ${timeZone}`);
    console.log(
      `[audit:timestamps] ${summary.totalColumns} naive timestamp column(s) across ` +
        `${summary.totalTables} table(s) — tenant ${summary.tenantColumns}, global ${summary.globalColumns}\n`,
    );
    console.log(
      `${"table.column".padEnd(64)} ${"rows".padStart(12)} ${"scope".padStart(8)} ${"nullable".padStart(9)}`,
    );
    console.log("-".repeat(98));
    for (const item of summary.columns) {
      console.log(
        `${`${item.table}.${item.column}`.padEnd(64)} ${String(item.estimatedRows ?? "unknown").padStart(12)} ` +
          `${item.scope.padStart(8)} ${String(item.nullable).padStart(9)}`,
      );
    }
    console.log(
      "\nNext: verify the session timezone and a sample row's timestamptz twin, then follow\n" +
        "docs/timestamp-migration.md per table. This audit does not alter schema or data.",
    );
  }

  await closeDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, "audit:timestamps failed");
  console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
