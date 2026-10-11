import { and, eq, inArray, sql } from "drizzle-orm";
import {
  DEFAULT_VOUCHER_NUMBERING,
  formatVoucherNumber,
  voucherFormatKey,
  voucherNumberingUpdateSchema,
  voucherSequencePattern,
  type VoucherNumberingUpdate,
} from "@mms/shared";
import {
  accountingEntries,
  accountingVoucherCounters,
  accountingVoucherNumbering,
} from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { resolveVoucherPeriod, type VoucherPeriod } from "./accountingVoucherPeriod.js";

/** Bound on catch-up rounds after hand-typed refs are found ahead of the counter. */
const MAX_COLLISION_ROUNDS = 5;

export type StoredVoucherNumbering = VoucherNumberingUpdate & { updatedAt?: string };

async function readConfig(
  tx: TenantTransaction,
  subdomain: string,
): Promise<StoredVoucherNumbering> {
  const [row] = await tx
    .select({
      autoGenerate: accountingVoucherNumbering.autoGenerate,
      prefix: accountingVoucherNumbering.prefix,
      delimiter: accountingVoucherNumbering.delimiter,
      yearFormat: accountingVoucherNumbering.yearFormat,
      sequenceDigits: accountingVoucherNumbering.sequenceDigits,
      startingSequence: accountingVoucherNumbering.startingSequence,
      rolloverPolicy: accountingVoucherNumbering.rolloverPolicy,
      updatedAt: accountingVoucherNumbering.updatedAt,
    })
    .from(accountingVoucherNumbering)
    .where(eq(accountingVoucherNumbering.workspaceSubdomain, subdomain))
    .limit(1);
  if (!row) return { ...DEFAULT_VOUCHER_NUMBERING };
  const { updatedAt, ...stored } = row;
  return { ...voucherNumberingUpdateSchema.parse(stored), updatedAt: updatedAt.toISOString() };
}

/** Highest sequence already present in refs of this period, including trashed entries. */
function existingMaxSequence(subdomain: string, pattern: string) {
  return sql<number>`COALESCE((
    SELECT max((regexp_match(${accountingEntries.ref}, ${pattern}))[1]::int)
    FROM ${accountingEntries}
    WHERE ${accountingEntries.workspaceSubdomain} = ${subdomain} AND ${accountingEntries.ref} ~ ${pattern}
  ), 0)`;
}

function counterWhere(subdomain: string, config: VoucherNumberingUpdate, periodYear: number) {
  return and(
    eq(accountingVoucherCounters.workspaceSubdomain, subdomain),
    eq(accountingVoucherCounters.formatKey, voucherFormatKey(config)),
    eq(accountingVoucherCounters.periodYear, periodYear),
  );
}

export async function getVoucherNumbering(tenant: string): Promise<StoredVoucherNumbering> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, (tx) => readConfig(tx, subdomain));
}

export async function saveVoucherNumbering(
  tenant: string,
  config: VoucherNumberingUpdate,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const values = { ...config, updatedAt: new Date() };
    await tx
      .insert(accountingVoucherNumbering)
      .values({ workspaceSubdomain: subdomain, ...values })
      .onConflictDoUpdate({ target: accountingVoucherNumbering.workspaceSubdomain, set: values });
  });
}

/** Last issued sequence for the period `date` falls in, without consuming a number. */
export async function peekVoucherSequence(
  tenant: string,
  date: string | undefined,
): Promise<{ config: StoredVoucherNumbering; period: VoucherPeriod; lastValue: number }> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const config = await readConfig(tx, subdomain);
    const period = await resolveVoucherPeriod(tx, subdomain, config, date);
    const floor = config.startingSequence - 1;
    const [counter] = await tx
      .select({ lastValue: accountingVoucherCounters.lastValue })
      .from(accountingVoucherCounters)
      .where(counterWhere(subdomain, config, period.periodYear))
      .limit(1);
    if (counter) return { config, period, lastValue: Math.max(counter.lastValue, floor) };
    const seed = await tx.execute(
      sql`SELECT ${existingMaxSequence(subdomain, voucherSequencePattern(config, period.periodYear))} AS value`,
    );
    const value = Number((seed.rows as Array<{ value: unknown }>)[0]?.value ?? 0);
    return { config, period, lastValue: Math.max(value, floor) };
  });
}

async function claimSequences(
  tx: TenantTransaction,
  subdomain: string,
  config: VoucherNumberingUpdate,
  periodYear: number,
  count: number,
): Promise<number[]> {
  const floor = config.startingSequence - 1;
  const [row] = await tx
    .insert(accountingVoucherCounters)
    .values({
      workspaceSubdomain: subdomain,
      formatKey: voucherFormatKey(config),
      periodYear,
      lastValue: sql`GREATEST(${existingMaxSequence(subdomain, voucherSequencePattern(config, periodYear))}, ${floor}) + ${count}`,
    })
    .onConflictDoUpdate({
      target: [
        accountingVoucherCounters.workspaceSubdomain,
        accountingVoucherCounters.formatKey,
        accountingVoucherCounters.periodYear,
      ],
      set: {
        lastValue: sql`GREATEST(${accountingVoucherCounters.lastValue}, ${floor}) + ${count}`,
        updatedAt: new Date(),
      },
    })
    .returning({ lastValue: accountingVoucherCounters.lastValue });
  const last = row?.lastValue ?? count;
  return Array.from({ length: count }, (_, index) => last - count + 1 + index);
}

/** Moves a counter that fell behind existing refs (hand-typed, restored) past them. */
async function catchUpCounter(
  tx: TenantTransaction,
  subdomain: string,
  config: VoucherNumberingUpdate,
  periodYear: number,
) {
  const pattern = voucherSequencePattern(config, periodYear);
  await tx
    .update(accountingVoucherCounters)
    .set({
      lastValue: sql`GREATEST(${accountingVoucherCounters.lastValue}, ${existingMaxSequence(subdomain, pattern)})`,
    })
    .where(counterWhere(subdomain, config, periodYear));
}

/**
 * Issues `count` voucher numbers for the period `date` falls in, or `null` when
 * automatic numbering is off. Must run inside the entry write transaction: the
 * counter row stays locked until commit, and a rollback returns the numbers.
 * Refs already taken (hand-typed, trashed, or in `reserved`) are never issued.
 */
export async function allocateVoucherNumbers(
  tenant: string,
  options: { date?: string; count?: number; reserved?: ReadonlySet<string> },
): Promise<string[] | null> {
  const subdomain = tenant.trim().toLowerCase();
  const wanted = Math.max(1, options.count ?? 1);
  return withTenant(subdomain, async (tx) => {
    const config = await readConfig(tx, subdomain);
    if (!config.autoGenerate) return null;
    const { periodYear, printYear } = await resolveVoucherPeriod(
      tx,
      subdomain,
      config,
      options.date,
    );
    const issued: string[] = [];
    for (let round = 0; issued.length < wanted; round += 1) {
      if (round >= MAX_COLLISION_ROUNDS) {
        throw new Error("Unable to allocate a free voucher number; check hand-typed references");
      }
      const candidates = (
        await claimSequences(tx, subdomain, config, periodYear, wanted - issued.length)
      ).map((sequence) => formatVoucherNumber(sequence, config, printYear));
      const takenRows = await tx
        .select({ ref: accountingEntries.ref })
        .from(accountingEntries)
        .where(
          and(
            eq(accountingEntries.workspaceSubdomain, subdomain),
            inArray(accountingEntries.ref, candidates),
          ),
        );
      const taken = new Set(takenRows.map((row) => row.ref));
      const free = candidates.filter(
        (candidate) => !taken.has(candidate) && !options.reserved?.has(candidate),
      );
      issued.push(...free);
      if (taken.size > 0) await catchUpCounter(tx, subdomain, config, periodYear);
    }
    return issued;
  });
}
