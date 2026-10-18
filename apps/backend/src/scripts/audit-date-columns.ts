import { sql } from 'drizzle-orm';
import { loadBackendEnv } from '../config/loadEnv.js';
import { closeDatabase, initializeDatabaseConnection } from '../db/dbConnection.js';
import { withGlobalTenant } from '../db/tenant-context.js';
import { logger } from '../lib/logger.js';

loadBackendEnv();

/**
 * Read-only audit for Phase 7 (varchar → date). For every academic date column it counts empty,
 * `YYYY-MM-DD`, `YYYY-MM-DDT…` (date-time prefix) and unparseable values. Migration 0172 maps
 * empty → NULL and date-time → its date part; it refuses to run while "other" values remain.
 *
 *   pnpm --filter mms-backend audit:date-columns
 */
export const PHASE7_DATE_COLUMNS: ReadonlyArray<readonly [table: string, column: string]> = [
  ['sessions', 'start_date'], ['sessions', 'end_date'],
  ['session_classes', 'age_calc_date'],
  ['session_class_schedules', 'start_date'], ['session_class_schedules', 'end_date'],
  ['session_class_discounts', 'start_date'], ['session_class_discounts', 'end_date'],
  ['session_class_scholarships', 'expiry_date'],
  ['session_class_timetables', 'date'], ['session_class_refreshments', 'date'],
  ['attendance_leaves', 'from_date'], ['attendance_leaves', 'to_date'],
  ['exams', 'date'],
  ['attendance', 'date'], ['enrollments', 'enrolled_date'],
  ['students', 'registered_date'], ['students', 'enrollment_date'],
];

const DATE_RE = '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$';
const DATETIME_RE = '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])[T ]';

type ColumnCounts = { total: number; empty: number; date: number; datetime: number; other: number; sample: string | null };

async function main(): Promise<void> {
  initializeDatabaseConnection();
  const reports = await withGlobalTenant(async (tx) => {
    const out: Array<{ name: string } & ColumnCounts> = [];
    for (const [table, column] of PHASE7_DATE_COLUMNS) {
      const col = sql.identifier(column);
      const result = await tx.execute<ColumnCounts>(sql`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE ${col} IS NULL OR btrim(${col}::text) = '')::int AS empty,
               count(*) FILTER (WHERE btrim(${col}::text) ~ ${DATE_RE})::int AS date,
               count(*) FILTER (WHERE btrim(${col}::text) ~ ${DATETIME_RE})::int AS datetime,
               count(*) FILTER (WHERE btrim(coalesce(${col}::text, '')) <> '' AND btrim(${col}::text) !~ ${DATE_RE} AND btrim(${col}::text) !~ ${DATETIME_RE})::int AS other,
               min(${col}::text) FILTER (WHERE btrim(coalesce(${col}::text, '')) <> '' AND btrim(${col}::text) !~ ${DATE_RE} AND btrim(${col}::text) !~ ${DATETIME_RE}) AS sample
          FROM ${sql.identifier(table)}`);
      const row = result.rows[0];
      out.push({ name: `${table}.${column}`, total: Number(row?.total ?? 0), empty: Number(row?.empty ?? 0), date: Number(row?.date ?? 0),
        datetime: Number(row?.datetime ?? 0), other: Number(row?.other ?? 0), sample: row?.sample ?? null });
    }
    return out;
  });
  console.log(`${'column'.padEnd(42)} ${'total'.padStart(8)} ${'empty'.padStart(7)} ${'date'.padStart(8)} ${'dt'.padStart(6)} ${'other'.padStart(6)}`);
  for (const r of reports) {
    console.log(`${r.name.padEnd(42)} ${String(r.total).padStart(8)} ${String(r.empty).padStart(7)} ${String(r.date).padStart(8)} ${String(r.datetime).padStart(6)} ${String(r.other).padStart(6)}${r.sample ? `  e.g. ${JSON.stringify(r.sample)}` : ''}`);
  }
  if (reports.some((r) => r.other > 0)) process.exitCode = 1;
  await closeDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'audit:date-columns failed');
  process.exitCode = 1;
  await closeDatabase();
});
