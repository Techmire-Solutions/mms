import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  DEFAULT_HYPERINFLATION_SETTINGS,
  type HyperinflationSettings,
  type Ias29Run,
  type MonthlyMovement,
  type PriceIndexPoint,
} from "@mms/shared";
import {
  accountingAccounts,
  accountingHyperinflationSettings,
  accountingIas29Lines,
  accountingIas29Runs,
  accountingPriceIndices,
} from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { canonicalStoredRate as trimNumeric } from "./repositoryFxMappers.js";

const tenantKey = (tenant: string) => tenant.trim().toLowerCase();

export async function getHyperinflationSettings(tenant: string): Promise<HyperinflationSettings> {
  const subdomain = tenantKey(tenant);
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({
        enabled: accountingHyperinflationSettings.enabled,
        netMonetaryAccountId: accountingHyperinflationSettings.netMonetaryAccountId,
        appliesFrom: accountingHyperinflationSettings.appliesFrom,
        indexName: accountingHyperinflationSettings.indexName,
        updatedAt: accountingHyperinflationSettings.updatedAt,
      })
      .from(accountingHyperinflationSettings)
      .where(eq(accountingHyperinflationSettings.workspaceSubdomain, subdomain));
    if (!row) return { ...DEFAULT_HYPERINFLATION_SETTINGS };
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  });
}

export async function saveHyperinflationSettings(
  tenant: string,
  settings: HyperinflationSettings,
  userId: string | null,
): Promise<void> {
  const subdomain = tenantKey(tenant);
  const values = {
    enabled: settings.enabled,
    netMonetaryAccountId: settings.netMonetaryAccountId,
    appliesFrom: settings.appliesFrom,
    indexName: settings.indexName,
    updatedAt: new Date(),
    updatedBy: userId,
  };
  await withTenant(subdomain, (tx) =>
    tx
      .insert(accountingHyperinflationSettings)
      .values({ workspaceSubdomain: subdomain, ...values })
      .onConflictDoUpdate({ target: accountingHyperinflationSettings.workspaceSubdomain, set: values }),
  );
}

/** True when `accountId` is an active account of the workspace. */
export async function accountExists(tenant: string, accountId: string): Promise<boolean> {
  const subdomain = tenantKey(tenant);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: accountingAccounts.id })
      .from(accountingAccounts)
      .where(and(eq(accountingAccounts.workspaceSubdomain, subdomain), eq(accountingAccounts.id, accountId)))
      .limit(1);
    return rows.length > 0;
  });
}

export async function listPriceIndices(tenant: string): Promise<PriceIndexPoint[]> {
  const subdomain = tenantKey(tenant);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        indexDate: accountingPriceIndices.indexDate,
        value: accountingPriceIndices.value,
        source: accountingPriceIndices.source,
      })
      .from(accountingPriceIndices)
      .where(eq(accountingPriceIndices.workspaceSubdomain, subdomain))
      .orderBy(asc(accountingPriceIndices.indexDate));
    return rows.map((row) => ({ ...row, value: trimNumeric(row.value) }));
  });
}

/** Upsert index points by date; points not in the payload are kept. */
export async function upsertPriceIndices(
  tenant: string,
  points: readonly PriceIndexPoint[],
  userId: string | null,
): Promise<void> {
  const subdomain = tenantKey(tenant);
  await withTenant(subdomain, (tx) =>
    tx
      .insert(accountingPriceIndices)
      .values(points.map((point) => ({ workspaceSubdomain: subdomain, ...point, updatedBy: userId })))
      .onConflictDoUpdate({
        target: [accountingPriceIndices.workspaceSubdomain, accountingPriceIndices.indexDate],
        set: {
          value: sql`excluded.value`,
          source: sql`excluded.source`,
          updatedAt: sql`now()`,
          updatedBy: sql`excluded.updated_by`,
        },
      }),
  );
}

/**
 * Net functional movement per account × calendar month up to `date` (posted,
 * active entries). Earlier IAS 29 postings are excluded: each is reversed the
 * next day, and restating them again at a different month's index would leave
 * a residue.
 */
export async function listMonthlyMovements(tenant: string, date: string): Promise<MonthlyMovement[]> {
  const subdomain = tenantKey(tenant);
  return withTenantRead(subdomain, async (tx) => {
    const { rows } = await tx.execute<{
      account_id: string;
      code: string;
      name: string;
      type: string;
      is_monetary: boolean;
      month: string;
      net_func: string;
    }>(sql`
      SELECT l.account_id, a.code, a.name, a.type, a.is_monetary, left(e.date::text, 7) AS month,
        (SUM(COALESCE(l.func_debit, l.debit)) - SUM(COALESCE(l.func_credit, l.credit)))::text AS net_func
      FROM accounting_journal_lines l
      JOIN accounting_entries e
        ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
      JOIN accounting_accounts a
        ON a.workspace_subdomain = l.workspace_subdomain AND a.id = l.account_id
      WHERE l.workspace_subdomain = ${subdomain}
        AND e.status = 'posted' AND e.deleted_at IS NULL AND e.date <= ${date}
        AND COALESCE(e.source_type, '') NOT IN ('ias29_restate', 'ias29_reversal')
      GROUP BY l.account_id, a.code, a.name, a.type, a.is_monetary, left(e.date::text, 7)
      HAVING SUM(COALESCE(l.func_debit, l.debit)) - SUM(COALESCE(l.func_credit, l.credit)) <> 0
      ORDER BY a.code, month`);
    return rows.map((row) => ({
      accountId: row.account_id,
      accountCode: row.code,
      accountName: row.name,
      type: row.type,
      isMonetary: row.is_monetary,
      month: row.month,
      netFunc: trimNumeric(row.net_func),
    }));
  });
}

const runColumns = {
  id: accountingIas29Runs.id,
  restatementDate: accountingIas29Runs.restatementDate,
  closingIndex: accountingIas29Runs.closingIndex,
  netMonetaryResult: accountingIas29Runs.netMonetaryResult,
  entryId: accountingIas29Runs.entryId,
  reversalEntryId: accountingIas29Runs.reversalEntryId,
  createdAt: accountingIas29Runs.createdAt,
  createdBy: accountingIas29Runs.createdBy,
};

/** Posted restatements, newest first (bounded to `limit`). */
export async function listIas29Runs(tenant: string, limit = 24): Promise<Ias29Run[]> {
  const subdomain = tenantKey(tenant);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(runColumns)
      .from(accountingIas29Runs)
      .where(eq(accountingIas29Runs.workspaceSubdomain, subdomain))
      .orderBy(desc(accountingIas29Runs.restatementDate))
      .limit(limit);
    if (rows.length === 0) return [];
    const lines = await tx
      .select({
        runId: accountingIas29Lines.runId,
        accountId: accountingIas29Lines.accountId,
        carrying: accountingIas29Lines.carrying,
        restated: accountingIas29Lines.restated,
        adjustment: accountingIas29Lines.adjustment,
        accountCode: accountingAccounts.code,
        accountName: accountingAccounts.name,
      })
      .from(accountingIas29Lines)
      .leftJoin(
        accountingAccounts,
        and(
          eq(accountingAccounts.workspaceSubdomain, accountingIas29Lines.workspaceSubdomain),
          eq(accountingAccounts.id, accountingIas29Lines.accountId),
        ),
      )
      .where(
        and(
          eq(accountingIas29Lines.workspaceSubdomain, subdomain),
          inArray(
            accountingIas29Lines.runId,
            rows.map((row) => row.id),
          ),
        ),
      )
      .orderBy(asc(accountingAccounts.code));
    return rows.map((row) => ({
      ...row,
      status: "posted" as const,
      closingIndex: trimNumeric(row.closingIndex),
      netMonetaryResult: trimNumeric(row.netMonetaryResult),
      createdAt: row.createdAt.toISOString(),
      lines: lines
        .filter((line) => line.runId === row.id)
        .map((line) => ({
          accountId: line.accountId,
          accountCode: line.accountCode ?? "",
          accountName: line.accountName ?? "",
          carrying: trimNumeric(line.carrying),
          restated: trimNumeric(line.restated),
          adjustment: trimNumeric(line.adjustment),
        })),
    }));
  });
}

export async function findIas29RunId(tenant: string, date: string): Promise<string | null> {
  const subdomain = tenantKey(tenant);
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .select({ id: accountingIas29Runs.id })
      .from(accountingIas29Runs)
      .where(
        and(eq(accountingIas29Runs.workspaceSubdomain, subdomain), eq(accountingIas29Runs.restatementDate, date)),
      );
    return row?.id ?? null;
  });
}

export async function saveIas29Run(tenant: string, run: Omit<Ias29Run, "status" | "createdAt">): Promise<void> {
  const subdomain = tenantKey(tenant);
  await withTenant(subdomain, async (tx) => {
    await tx.insert(accountingIas29Runs).values({
      id: run.id,
      workspaceSubdomain: subdomain,
      restatementDate: run.restatementDate,
      closingIndex: run.closingIndex,
      netMonetaryResult: run.netMonetaryResult,
      entryId: run.entryId,
      reversalEntryId: run.reversalEntryId,
      createdBy: run.createdBy ?? null,
    });
    if (run.lines.length > 0) {
      await tx.insert(accountingIas29Lines).values(
        run.lines.map((line, index) => ({
          id: `ias29l-${index + 1}`,
          workspaceSubdomain: subdomain,
          runId: run.id,
          accountId: line.accountId,
          carrying: line.carrying,
          restated: line.restated,
          adjustment: line.adjustment,
        })),
      );
    }
  });
}
