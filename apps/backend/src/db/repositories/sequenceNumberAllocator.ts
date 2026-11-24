import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  formatSequenceNumber,
  sequenceFormatKey,
  sequenceNumberingIsUnambiguous,
  sequencePattern,
  type SequenceNumberingConfig,
} from "@mms/contracts";
import { withTenant, type TenantTransaction } from "@mms/db/context";

/** Bound on catch-up rounds after hand-typed numbers are found ahead of the counter. */
const MAX_COLLISION_ROUNDS = 5;

/** A Drizzle table whose columns are accessed by name (see `moduleSetupRepoSingletonJson.ts`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic column lookup
type DynamicTable = PgTable & Record<string, any>;

/** The shared `(workspace_subdomain, format_key, period_year, last_value, updated_at)` counter shape. */
type CounterTable = DynamicTable & {
  workspaceSubdomain: PgColumn;
  formatKey: PgColumn;
  periodYear: PgColumn;
  lastValue: PgColumn;
  updatedAt: PgColumn;
};

/** A tenant document table whose number column is scanned for seeding and collision probing. */
type DocTable = DynamicTable & { workspaceSubdomain: PgColumn };

export interface SequenceAllocatorDeps {
  /** Human label for error messages ("voucher", "receipt", "invoice"). */
  label: string;
  counterTable: CounterTable;
  docTable: DocTable;
  docNumberColumn: PgColumn;
  /** Resolves the numbering config, or `null` to skip allocation (automatic numbering off). */
  readConfig: (tx: TenantTransaction, subdomain: string) => Promise<SequenceNumberingConfig | null>;
  /** Resolves the counter period; defaults to calendar-year rollover. */
  resolvePeriod?: (
    tx: TenantTransaction,
    subdomain: string,
    config: SequenceNumberingConfig,
    date: string | undefined,
  ) => Promise<{ periodYear: number; printYear: number; printMonth: number }>;
}

/** Calendar-year/month rollover shared by obligations and finance (no fiscal calendar). */
function defaultResolvePeriod(
  config: SequenceNumberingConfig,
  date: string | undefined,
): { periodYear: number; printYear: number; printMonth: number } {
  const year = Number(date?.slice(0, 4));
  const month = Number(date?.slice(5, 7));
  const printYear = Number.isInteger(year) && year > 0 ? year : new Date().getFullYear();
  const printMonth =
    Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;

  let periodYear: number;
  if (config.rolloverPolicy === "never") periodYear = 0;
  else if (config.rolloverPolicy === "monthly") periodYear = printYear * 100 + printMonth;
  else periodYear = printYear;
  return { periodYear, printYear, printMonth };
}

/**
 * Issues `count` numbers for the period `date` falls in, or `null` when automatic
 * numbering is off. Must run inside the document write transaction: the counter row
 * stays locked until commit, and a rollback returns the numbers. Numbers already
 * taken (hand-typed, trashed, or in `reserved`) are never issued.
 *
 * Single implementation behind the accounting, obligations and finance allocators.
 */
export async function allocateSequenceNumbers(
  tenant: string,
  deps: SequenceAllocatorDeps,
  options: { date?: string; count?: number; reserved?: ReadonlySet<string> } = {},
): Promise<string[] | null> {
  const subdomain = tenant.trim().toLowerCase();
  const wanted = Math.max(1, options.count ?? 1);
  const { label, counterTable, docTable, docNumberColumn, readConfig, resolvePeriod } = deps;

  /** Highest sequence already present in numbers of this period, including trashed rows. */
  const existingMax = (pattern: string) =>
    sql<number>`COALESCE((
      SELECT max((regexp_match(${docNumberColumn}, ${pattern}))[1]::int)
      FROM ${docTable}
      WHERE ${docTable.workspaceSubdomain} = ${subdomain} AND ${docNumberColumn} ~ ${pattern}
    ), 0)`;

  const counterWhere = (formatKey: string, periodYear: number) =>
    and(
      eq(counterTable.workspaceSubdomain, subdomain),
      eq(counterTable.formatKey, formatKey),
      eq(counterTable.periodYear, periodYear),
    );

  const claimSequences = async (
    tx: TenantTransaction,
    config: SequenceNumberingConfig,
    formatKey: string,
    periodYear: number,
    count: number,
  ): Promise<number[]> => {
    const floor = config.startingSequence - 1;
    const pattern = sequencePattern(config, periodYear);
    // Seed the counter only when the period's row does not exist yet.
    //
    // The regex seed must NOT live in `ON CONFLICT DO UPDATE`: VALUES are evaluated
    // before conflict detection, so every allocation would scan the document table
    // with `number ~ pattern` (no index can serve `~`). Split into DO NOTHING + UPDATE
    // so the scan runs once per counter row, not once per allocation.
    await tx
      .insert(counterTable)
      .values({
        workspaceSubdomain: subdomain,
        formatKey,
        periodYear,
        lastValue: sql`GREATEST(${existingMax(pattern)}, ${floor})`,
      })
      .onConflictDoNothing({
        target: [counterTable.workspaceSubdomain, counterTable.formatKey, counterTable.periodYear],
      });
    // The UPDATE (re)reads the row under its row lock, so concurrent allocators serialize
    // here and each gets a disjoint range. A losing INSERT from a concurrent transaction
    // resolves as DO NOTHING and then joins this UPDATE.
    const [row] = await tx
      .update(counterTable)
      .set({
        lastValue: sql`GREATEST(${counterTable.lastValue}, ${floor}) + ${count}`,
        updatedAt: new Date(),
      })
      .where(counterWhere(formatKey, periodYear))
      .returning({ lastValue: counterTable.lastValue });
    const last = (row?.lastValue as number | undefined) ?? count;
    return Array.from({ length: count }, (_, index) => last - count + 1 + index);
  };

  const catchUp = async (
    tx: TenantTransaction,
    config: SequenceNumberingConfig,
    formatKey: string,
    periodYear: number,
  ): Promise<void> => {
    const pattern = sequencePattern(config, periodYear);
    await tx
      .update(counterTable)
      .set({
        lastValue: sql`GREATEST(${counterTable.lastValue}, ${existingMax(pattern)})`,
      })
      .where(counterWhere(formatKey, periodYear));
  };

  return withTenant(subdomain, async (tx) => {
    const config = await readConfig(tx, subdomain);
    if (!config) return null;
    if (!sequenceNumberingIsUnambiguous(config)) {
      throw new Error(`${label} numbering that restarts every year must include the year`);
    }

    const { periodYear, printYear, printMonth } = await (resolvePeriod
      ? resolvePeriod(tx, subdomain, config, options.date)
      : defaultResolvePeriod(config, options.date));
    const formatKey = sequenceFormatKey(config);

    const issued: string[] = [];
    for (let round = 0; issued.length < wanted; round += 1) {
      if (round >= MAX_COLLISION_ROUNDS) {
        throw new Error(
          `Unable to allocate a free ${label} number; check hand-typed ${label} numbers`,
        );
      }
      const candidates = (
        await claimSequences(tx, config, formatKey, periodYear, wanted - issued.length)
      ).map((sequence) => formatSequenceNumber(sequence, config, printYear, printMonth));
      const takenRows = await tx
        .select({ number: docNumberColumn })
        .from(docTable)
        .where(
          and(eq(docTable.workspaceSubdomain, subdomain), inArray(docNumberColumn, candidates)),
        );
      const taken = new Set(takenRows.map((row) => row.number));
      const free = candidates.filter(
        (candidate) => !taken.has(candidate) && !options.reserved?.has(candidate),
      );
      issued.push(...free);
      if (taken.size > 0) await catchUp(tx, config, formatKey, periodYear);
    }
    return issued;
  });
}
