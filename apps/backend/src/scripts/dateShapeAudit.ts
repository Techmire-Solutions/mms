import { sql } from "drizzle-orm";
import { isValidIsoDate } from "@mms/shared";
import { closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { withGlobalTenant } from "../db/tenant-context.js";
import type { TenantTransaction } from "../db/tenant-context.js";
import { logger } from "../lib/logger.js";

/**
 * Shared read-only runner for the Phase 7 (varchar → date) audits. One scan per column buckets
 * every value by shape; a second, bounded query pulls the distinct `YYYY-MM-DD` prefixes so the
 * calendar check runs through `isValidIsoDate` — casting an impossible value in SQL would raise
 * and abort the audit instead of reporting it. Nothing is written.
 */
export type DateColumn = readonly [table: string, column: string];

const DATE_RE = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";
const DATETIME_RE = "^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ]";
/** A date-time whose clock is not midnight and carries a zone: its date part may be the wrong day locally. */
const ZONED_CLOCK_RE = "[T ](?!00:00(:00(\\.0+)?)?)[0-9]{2}:[0-9]{2}.*(Z|[+-][0-9]{2}:?[0-9]{2})$";
const DMY_RE = "^[0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{4}$";
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const PREFIX_LIMIT = 50_000;
/**
 * Set by the production ops-audit workflow, whose logs are public: samples keep their shape
 * (digits → 9, letters → a) but never the stored value. Impossible or out-of-range calendar
 * days stay readable: a bare date is not tenant data.
 */
const REDACT_SAMPLES = process.env.AUDIT_REDACT_SAMPLES === "1";

const redact = (value: string): string =>
  REDACT_SAMPLES ? value.replace(/\p{N}/gu, "9").replace(/\p{L}/gu, "a").slice(0, 40) : value;

type ShapeRow = {
  total: number;
  empty: number;
  date: number;
  datetime: number;
  zoned: number;
  dmy: number;
  other: number;
  min: string | null;
  max: string | null;
  samples: string[] | null;
};

export interface DateShapeReport extends Omit<ShapeRow, "samples"> {
  name: string;
  impossible: number;
  outOfRange: number;
  samples: string[];
}

export interface DateShapeAuditOptions {
  label: string;
  columns: ReadonlyArray<DateColumn>;
  /** Shapes that block the matching contract migration. `other` always blocks. */
  blockOn?: ReadonlyArray<"impossible" | "outOfRange" | "dmy" | "zoned">;
}

async function columnExists(tx: TenantTransaction, [table, column]: DateColumn): Promise<boolean> {
  const result = await tx.execute<{ ok: boolean }>(sql`SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}) AS ok`);
  return result.rows[0]?.ok === true;
}

async function auditColumn(
  tx: TenantTransaction,
  [table, column]: DateColumn,
): Promise<DateShapeReport> {
  const v = sql`btrim(${sql.identifier(column)}::text)`;
  const unknown = sql`${v} <> '' AND ${v} !~ ${DATE_RE} AND ${v} !~ ${DATETIME_RE} AND ${v} !~ ${DMY_RE}`;
  const shapes = await tx.execute<ShapeRow>(sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE ${v} IS NULL OR ${v} = '')::int AS empty,
           count(*) FILTER (WHERE ${v} ~ ${DATE_RE})::int AS date,
           count(*) FILTER (WHERE ${v} ~ ${DATETIME_RE})::int AS datetime,
           count(*) FILTER (WHERE ${v} ~ ${DATETIME_RE} AND ${v} ~ ${ZONED_CLOCK_RE})::int AS zoned,
           count(*) FILTER (WHERE ${v} ~ ${DMY_RE})::int AS dmy,
           count(*) FILTER (WHERE ${unknown})::int AS other,
           min(left(${v}, 10)) FILTER (WHERE ${v} ~ ${DATETIME_RE} OR ${v} ~ ${DATE_RE}) AS min,
           max(left(${v}, 10)) FILTER (WHERE ${v} ~ ${DATETIME_RE} OR ${v} ~ ${DATE_RE}) AS max,
           (array_agg(DISTINCT ${v}) FILTER (WHERE ${unknown} OR ${v} ~ ${DMY_RE}))[1:3] AS samples
      FROM ${sql.identifier(table)}`);
  const row = shapes.rows[0];

  const prefixes = await tx.execute<{ day: string }>(sql`
    SELECT DISTINCT left(${v}, 10) AS day
      FROM ${sql.identifier(table)}
     WHERE ${v} ~ ${DATE_RE} OR ${v} ~ ${DATETIME_RE}
     LIMIT ${PREFIX_LIMIT}`);
  let impossible = 0;
  let outOfRange = 0;
  const badDays: string[] = [];
  for (const { day } of prefixes.rows) {
    const year = Number(day.slice(0, 4));
    if (!isValidIsoDate(day)) impossible += 1;
    else if (year < MIN_YEAR || year > MAX_YEAR) outOfRange += 1;
    else continue;
    if (badDays.length < 3) badDays.push(day);
  }

  return {
    name: `${table}.${column}`,
    total: Number(row?.total ?? 0),
    empty: Number(row?.empty ?? 0),
    date: Number(row?.date ?? 0),
    datetime: Number(row?.datetime ?? 0),
    zoned: Number(row?.zoned ?? 0),
    dmy: Number(row?.dmy ?? 0),
    other: Number(row?.other ?? 0),
    min: row?.min ?? null,
    max: row?.max ?? null,
    impossible,
    outOfRange,
    samples: [...(row?.samples ?? []).map(redact), ...badDays],
  };
}

const COLUMNS = [
  "total",
  "empty",
  "date",
  "datetime",
  "zoned",
  "dmy",
  "other",
  "impossible",
  "outOfRange",
] as const;
const HEADERS = ["total", "empty", "date", "dt", "zoned", "dmy", "other", "bad-day", "range"];

function printReports(reports: DateShapeReport[], missing: string[]): void {
  console.log(`${"column".padEnd(46)} ${HEADERS.map((h) => h.padStart(8)).join(" ")}  span`);
  for (const r of reports) {
    const cells = COLUMNS.map((key) => String(r[key]).padStart(8)).join(" ");
    const span = r.min ? `${r.min}..${r.max}` : "-";
    console.log(`${r.name.padEnd(46)} ${cells}  ${span}`);
    if (r.samples.length > 0)
      console.log(`${"".padEnd(46)} e.g. ${r.samples.map((s) => JSON.stringify(s)).join(", ")}`);
  }
  for (const name of missing) console.log(`${name.padEnd(46)} (column not present — skipped)`);
  console.log(
    "\n  dt = date-time prefix (date part kept) · zoned = dt with a non-midnight clock and a zone, whose" +
      "\n  local day may differ from its UTC prefix · dmy = DD/MM/YYYY-like (day/month order ambiguous)" +
      `\n  bad-day = distinct impossible calendar days · range = distinct days outside ${MIN_YEAR}–${MAX_YEAR}`,
  );
}

export async function runDateShapeAudit({
  label,
  columns,
  blockOn = [],
}: DateShapeAuditOptions): Promise<void> {
  try {
    initializeDatabaseConnection();
    const { reports, missing } = await withGlobalTenant(
      async (tx) => {
        const found: DateShapeReport[] = [];
        const skipped: string[] = [];
        for (const target of columns) {
          if (await columnExists(tx, target)) found.push(await auditColumn(tx, target));
          else skipped.push(`${target[0]}.${target[1]}`);
        }
        return { reports: found, missing: skipped };
      },
      { statementTimeoutMs: 120_000 },
    );
    printReports(reports, missing);
    const blocking = reports.filter((r) => r.other > 0 || blockOn.some((key) => r[key] > 0));
    if (blocking.length > 0) {
      console.log(
        `\n✗ ${label}: ${blocking.length} column(s) need reconciliation: ${blocking.map((r) => r.name).join(", ")}`,
      );
      process.exitCode = 1;
    } else {
      console.log(`\n✓ ${label}: every non-empty value converts to a date without guessing.`);
    }
  } catch (error: unknown) {
    logger.error({ err: error }, `${label} failed`);
    console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await closeDatabase().catch(() => undefined);
  }
}
