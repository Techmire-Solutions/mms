import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ForeignMonetaryBalance, FxRevaluationLine, FxRevaluationRun } from "@mms/shared";
import {
  accountingAccounts,
  accountingFxRevaluationLines,
  accountingFxRevaluationRuns,
} from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { canonicalStoredRate } from "./repositoryFxMappers.js";

/** `numeric(19,4)` text → plain decimal without trailing zeros ("-1500.0000" → "-1500"). */
const trimNumeric = canonicalStoredRate;

/**
 * Net foreign balances of revaluable monetary accounts as of `date` (posted,
 * active entries only), per account × currency, with their functional carrying
 * amount. Non-monetary accounts (inventory, fixed assets…) never appear.
 */
export async function listForeignMonetaryBalances(
  tenant: string,
  date: string,
  functionalCurrency: string,
): Promise<ForeignMonetaryBalance[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const { rows } = await tx.execute<{
      account_id: string;
      code: string;
      name: string;
      currency: string;
      open_txn: string;
      carrying_func: string;
    }>(sql`
      SELECT l.account_id, a.code, a.name, l.txn_currency AS currency,
        (SUM(COALESCE(l.txn_debit, 0)) - SUM(COALESCE(l.txn_credit, 0)))::text AS open_txn,
        (SUM(COALESCE(l.func_debit, l.debit)) - SUM(COALESCE(l.func_credit, l.credit)))::text AS carrying_func
      FROM accounting_journal_lines l
      JOIN accounting_entries e
        ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
      JOIN accounting_accounts a
        ON a.workspace_subdomain = l.workspace_subdomain AND a.id = l.account_id
      WHERE l.workspace_subdomain = ${subdomain}
        AND e.status = 'posted' AND e.deleted_at IS NULL AND e.date <= ${date}
        AND l.txn_currency IS NOT NULL AND l.txn_currency <> ${functionalCurrency}
        AND a.is_monetary AND a.allow_revaluation
      GROUP BY l.account_id, a.code, a.name, l.txn_currency
      HAVING SUM(COALESCE(l.txn_debit, 0)) - SUM(COALESCE(l.txn_credit, 0)) <> 0
        OR SUM(COALESCE(l.func_debit, l.debit)) - SUM(COALESCE(l.func_credit, l.credit)) <> 0
      ORDER BY a.code, l.txn_currency`);
    return rows.map((row) => ({
      accountId: row.account_id,
      accountCode: row.code,
      accountName: row.name,
      currency: row.currency,
      openTxn: trimNumeric(row.open_txn),
      carryingFunc: trimNumeric(row.carrying_func),
    }));
  });
}

const runColumns = {
  id: accountingFxRevaluationRuns.id,
  revaluationDate: accountingFxRevaluationRuns.revaluationDate,
  functionalCurrency: accountingFxRevaluationRuns.functionalCurrency,
  totalUnrealized: accountingFxRevaluationRuns.totalUnrealized,
  entryId: accountingFxRevaluationRuns.entryId,
  reversalEntryId: accountingFxRevaluationRuns.reversalEntryId,
  createdAt: accountingFxRevaluationRuns.createdAt,
  createdBy: accountingFxRevaluationRuns.createdBy,
};

/** Posted runs, newest first, with their lines (bounded to `limit` runs). */
export async function listFxRevaluationRuns(
  tenant: string,
  limit = 24,
): Promise<FxRevaluationRun[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const runs = await tx
      .select(runColumns)
      .from(accountingFxRevaluationRuns)
      .where(eq(accountingFxRevaluationRuns.workspaceSubdomain, subdomain))
      .orderBy(desc(accountingFxRevaluationRuns.revaluationDate))
      .limit(limit);
    if (runs.length === 0) return [];
    const lines = await tx
      .select({
        runId: accountingFxRevaluationLines.runId,
        accountId: accountingFxRevaluationLines.accountId,
        currency: accountingFxRevaluationLines.currency,
        openTxn: accountingFxRevaluationLines.openTxn,
        closingRate: accountingFxRevaluationLines.closingRate,
        carryingFunc: accountingFxRevaluationLines.carryingFunc,
        revaluedFunc: accountingFxRevaluationLines.revaluedFunc,
        unrealized: accountingFxRevaluationLines.unrealized,
        accountCode: accountingAccounts.code,
        accountName: accountingAccounts.name,
      })
      .from(accountingFxRevaluationLines)
      .leftJoin(
        accountingAccounts,
        and(
          eq(
            accountingAccounts.workspaceSubdomain,
            accountingFxRevaluationLines.workspaceSubdomain,
          ),
          eq(accountingAccounts.id, accountingFxRevaluationLines.accountId),
        ),
      )
      .where(
        and(
          eq(accountingFxRevaluationLines.workspaceSubdomain, subdomain),
          inArray(
            accountingFxRevaluationLines.runId,
            runs.map((run) => run.id),
          ),
        ),
      );
    return runs.map((run) => ({
      id: run.id,
      revaluationDate: run.revaluationDate,
      status: "posted" as const,
      functionalCurrency: run.functionalCurrency,
      totalUnrealized: trimNumeric(run.totalUnrealized),
      entryId: run.entryId,
      reversalEntryId: run.reversalEntryId,
      createdAt: run.createdAt.toISOString(),
      createdBy: run.createdBy,
      lines: lines
        .filter((line) => line.runId === run.id)
        .map((line) => ({
          accountId: line.accountId,
          accountCode: line.accountCode ?? "",
          accountName: line.accountName ?? "",
          currency: line.currency,
          openTxn: trimNumeric(line.openTxn),
          closingRate: trimNumeric(line.closingRate),
          carryingFunc: trimNumeric(line.carryingFunc),
          revaluedFunc: trimNumeric(line.revaluedFunc),
          unrealized: trimNumeric(line.unrealized),
        })),
    }));
  });
}

export async function findFxRevaluationRunId(tenant: string, date: string): Promise<string | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .select({ id: accountingFxRevaluationRuns.id })
      .from(accountingFxRevaluationRuns)
      .where(
        and(
          eq(accountingFxRevaluationRuns.workspaceSubdomain, subdomain),
          eq(accountingFxRevaluationRuns.revaluationDate, date),
        ),
      );
    return row?.id ?? null;
  });
}

/** True when a run exists on or after `fromDate` up to `toDate` (inclusive). */
export async function hasFxRevaluationBetween(
  tenant: string,
  fromDate: string,
  toDate: string,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: accountingFxRevaluationRuns.id })
      .from(accountingFxRevaluationRuns)
      .where(
        and(
          eq(accountingFxRevaluationRuns.workspaceSubdomain, subdomain),
          sql`${accountingFxRevaluationRuns.revaluationDate} BETWEEN ${fromDate} AND ${toDate}`,
        ),
      )
      .limit(1);
    return rows.length > 0;
  });
}

export async function saveFxRevaluationRun(
  tenant: string,
  run: Omit<FxRevaluationRun, "status" | "createdAt">,
  lines: readonly FxRevaluationLine[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.insert(accountingFxRevaluationRuns).values({
      id: run.id,
      workspaceSubdomain: subdomain,
      revaluationDate: run.revaluationDate,
      functionalCurrency: run.functionalCurrency,
      totalUnrealized: run.totalUnrealized,
      entryId: run.entryId,
      reversalEntryId: run.reversalEntryId,
      createdBy: run.createdBy ?? null,
    });
    if (lines.length > 0) {
      await tx.insert(accountingFxRevaluationLines).values(
        lines.map((line, index) => ({
          id: `fxrl-${index + 1}`,
          workspaceSubdomain: subdomain,
          runId: run.id,
          accountId: line.accountId,
          currency: line.currency,
          openTxn: line.openTxn,
          closingRate: line.closingRate,
          carryingFunc: line.carryingFunc,
          revaluedFunc: line.revaluedFunc,
          unrealized: line.unrealized,
        })),
      );
    }
  });
}
