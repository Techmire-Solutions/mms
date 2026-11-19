import { and, eq, sql } from "drizzle-orm";
import {
  DEFAULT_VOUCHER_NUMBERING,
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
import { withTenant, type AppDb, type TenantTransaction } from "../tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { resolveVoucherPeriod, type VoucherPeriod } from "./accountingVoucherPeriod.js";
import { allocateSequenceNumbers } from "./sequenceNumberAllocator.js";

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
    // Numbering is a ledger control: a silent change to the prefix, digits or
    // reset policy is how duplicate or skipped voucher numbers get introduced,
    // so the before/after state goes on the audit chain with the write.
    const previous = await readConfig(tx, subdomain);
    const values = { ...config, updatedAt: new Date() };
    await tx
      .insert(accountingVoucherNumbering)
      .values({ workspaceSubdomain: subdomain, ...values })
      .onConflictDoUpdate({ target: accountingVoucherNumbering.workspaceSubdomain, set: values });
    await recordModernAuditEvent(tx as unknown as AppDb, {
      workspaceSubdomain: subdomain,
      tableName: "accounting_voucher_numbering",
      recordId: subdomain,
      actionType: "UPDATE",
      oldState: previous,
      newState: { ...config, updatedAt: values.updatedAt.toISOString() },
    });
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
  return allocateSequenceNumbers(
    tenant,
    {
      label: "voucher",
      counterTable: accountingVoucherCounters,
      docTable: accountingEntries,
      docNumberColumn: accountingEntries.ref,
      readConfig: async (tx, subdomain) => {
        const config = await readConfig(tx, subdomain);
        return config.autoGenerate ? { ...config, currentSequence: 0 } : null;
      },
      resolvePeriod: (tx, subdomain, config, date) =>
        resolveVoucherPeriod(tx, subdomain, config, date),
    },
    options,
  );
}
