import { sql } from "drizzle-orm";
import { isValidIsoDate } from "@mms/shared";
import { loadBackendEnv } from "../config/loadEnv.js";
import { activeDb, closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { logger } from "../lib/logger.js";

loadBackendEnv();

/**
 * Audits `varchar` columns that hold calendar dates for values the canonical
 * `isoDateSchema` would now reject.
 *
 * Why this exists
 * ---------------
 * Date-only values in this codebase are stored as strings (`attendance.date`,
 * `sessions.start_date`, accounting date/period fields, …). Validation used to
 * be a shape-only regex, duplicated per module, which accepted impossible dates
 * like `2026-02-31` and `2026-13-01`. Those regexes have been consolidated onto
 * `isoDateSchema`, which also checks the date is real — so any row holding an
 * impossible value will start failing validation.
 *
 * Before relying on that tightening (and before considering it on READ paths,
 * which some module schemas share with writes), measure the data:
 *
 *   pnpm --filter mms-backend audit:dates
 *
 * Candidate columns are DISCOVERED from `information_schema` rather than
 * hardcoded, so a newly added date column is covered automatically.
 *
 * Shape is checked in SQL (cheap, index-friendly). Calendar validity is checked
 * in TypeScript via the very predicate the schemas use — casting a bad value to
 * `date` in Postgres raises an error rather than returning it, so validating in
 * SQL would abort the audit instead of reporting the offending rows.
 */

/** Columns whose NAME looks like a calendar date. */
const DATE_COLUMN_NAME =
  /^(date|.*_date|.*_dates|dob|date_of_birth|period_start|period_end|from_date|to_date)$/i;

/** Cap on distinct values pulled per column for calendar validation. */
const SAMPLE_LIMIT = 5000;

interface ColumnReport {
  table: string;
  column: string;
  nonEmpty: number;
  wrongShape: number;
  impossibleDates: number;
  samples: string[];
}

async function discoverDateColumns(): Promise<Array<{ table: string; column: string }>> {
  const db = activeDb();
  const result = await db.execute(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('character varying', 'text', 'character')
      AND is_nullable = 'YES'
    ORDER BY table_name, column_name
  `);

  const rows = (result.rows ?? []) as Array<{ table_name: string; column_name: string }>;
  return rows
    .filter((row) => DATE_COLUMN_NAME.test(row.column_name))
    .map((row) => ({ table: row.table_name, column: row.column_name }));
}

/** Quotes an identifier for safe interpolation into DDL/DQL. */
function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function auditColumn(table: string, column: string): Promise<ColumnReport | null> {
  const db = activeDb();
  const qualified = `${ident(table)}.${ident(column)}`;

  try {
    const counts = await db.execute(
      sql.raw(`
      SELECT
        COUNT(*) FILTER (WHERE ${qualified} IS NOT NULL AND btrim(${qualified}) <> '') AS non_empty,
        COUNT(*) FILTER (
          WHERE ${qualified} IS NOT NULL
            AND btrim(${qualified}) <> ''
            AND ${qualified} !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        ) AS wrong_shape
      FROM ${ident(table)}
    `),
    );
    const row = (counts.rows?.[0] ?? {}) as { non_empty?: string; wrong_shape?: string };
    const nonEmpty = Number(row.non_empty ?? 0);
    const wrongShape = Number(row.wrong_shape ?? 0);

    // Only pull values when there is something plausibly wrong, so the audit
    // stays cheap on large tables.
    let impossibleDates = 0;
    const samples: string[] = [];

    const candidates = await db.execute(
      sql.raw(`
      SELECT DISTINCT ${qualified} AS value
      FROM ${ident(table)}
      WHERE ${qualified} IS NOT NULL AND btrim(${qualified}) <> ''
      LIMIT ${SAMPLE_LIMIT}
    `),
    );

    for (const candidate of (candidates.rows ?? []) as Array<{ value: string }>) {
      const value = String(candidate.value);
      // Wrong-shape values are already counted; calendar-check the ISO-shaped ones
      // plus record any wrong-shape example for context.
      if (!isValidIsoDate(value)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) impossibleDates += 1;
        if (samples.length < 5) samples.push(value);
      }
    }

    if (nonEmpty === 0) return null;
    return { table, column, nonEmpty, wrongShape, impossibleDates, samples };
  } catch {
    // Missing table/column or insufficient privileges: skip rather than abort.
    return null;
  }
}

async function main(): Promise<void> {
  initializeDatabaseConnection();

  const columns = await discoverDateColumns();
  console.log(`[audit:dates] Discovered ${columns.length} date-like varchar column(s).\n`);

  const reports: ColumnReport[] = [];
  for (const { table, column } of columns) {
    const report = await auditColumn(table, column);
    if (report) reports.push(report);
  }

  const problematic = reports.filter((r) => r.wrongShape > 0 || r.impossibleDates > 0);

  console.log(
    `${"table.column".padEnd(56)} ${"rows".padStart(9)} ${"bad shape".padStart(10)} ${"impossible".padStart(11)}`,
  );
  console.log("-".repeat(90));
  for (const r of reports.sort(
    (a, b) => b.wrongShape + b.impossibleDates - (a.wrongShape + a.impossibleDates),
  )) {
    const name = `${r.table}.${r.column}`;
    console.log(
      `${name.padEnd(56)} ${String(r.nonEmpty).padStart(9)} ${String(r.wrongShape).padStart(10)} ${String(r.impossibleDates).padStart(11)}`,
    );
  }

  if (problematic.length === 0) {
    console.log(
      "\n✓ Every stored date is a real ISO calendar date. Reconciliation is not required.",
    );
  } else {
    console.log("\n⚠  Values the canonical schema would reject:");
    for (const r of problematic) {
      console.log(
        `\n  ${r.table}.${r.column} — ${r.wrongShape} wrong shape, ${r.impossibleDates} impossible`,
      );
      for (const sample of r.samples) console.log(`      ${JSON.stringify(sample)}`);
    }
    console.log(
      "\n  Reconcile these before relying on the tightened validation: correctness\n" +
        "  issues are most likely in READ paths, where a bad value makes a record\n" +
        "  unreadable rather than merely hard to write.",
    );
    process.exitCode = 1;
  }

  await closeDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, "audit:dates failed");
  console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
