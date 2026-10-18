import { and, eq } from "drizzle-orm";
import type {
  BankReconciliationMatch,
  BankStatement,
  OpeningBalance,
  PostingRules,
} from "@mms/shared";
import {
  accountingBankReconciliations,
  accountingBankStatementLines,
  accountingBankStatements,
  accountingOpeningBalances,
  accountingPostingRules,
} from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

export async function getPostingRules(tenant: string): Promise<PostingRules> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        arAccountId: accountingPostingRules.arAccountId,
        cashAccountId: accountingPostingRules.cashAccountId,
        incomeAccountId: accountingPostingRules.incomeAccountId,
        discountAccountId: accountingPostingRules.discountAccountId,
        updatedAt: accountingPostingRules.updatedAt,
      })
      .from(accountingPostingRules)
      .where(eq(accountingPostingRules.workspaceSubdomain, subdomain))
      .limit(1);
    const row = rows[0];
    if (!row) return {};
    return {
      arAccountId: row.arAccountId,
      cashAccountId: row.cashAccountId,
      incomeAccountId: row.incomeAccountId,
      discountAccountId: row.discountAccountId,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function savePostingRules(tenant: string, rules: PostingRules): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(accountingPostingRules)
      .values({
        workspaceSubdomain: subdomain,
        arAccountId: rules.arAccountId ?? null,
        cashAccountId: rules.cashAccountId ?? null,
        incomeAccountId: rules.incomeAccountId ?? null,
        discountAccountId: rules.discountAccountId ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountingPostingRules.workspaceSubdomain],
        set: {
          arAccountId: rules.arAccountId ?? null,
          cashAccountId: rules.cashAccountId ?? null,
          incomeAccountId: rules.incomeAccountId ?? null,
          discountAccountId: rules.discountAccountId ?? null,
          updatedAt: new Date(),
        },
      });
  });
}

export async function listOpeningBalances(
  tenant: string,
  fiscalYearId: string,
): Promise<OpeningBalance[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: accountingOpeningBalances.id,
        fiscalYearId: accountingOpeningBalances.fiscalYearId,
        accountId: accountingOpeningBalances.accountId,
        debit: accountingOpeningBalances.debit,
        credit: accountingOpeningBalances.credit,
      })
      .from(accountingOpeningBalances)
      .where(
        and(
          eq(accountingOpeningBalances.workspaceSubdomain, subdomain),
          eq(accountingOpeningBalances.fiscalYearId, fiscalYearId),
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      fiscalYearId: row.fiscalYearId,
      accountId: row.accountId,
      debit: Number(row.debit),
      credit: Number(row.credit),
    }));
  });
}

export async function replaceOpeningBalances(
  tenant: string,
  fiscalYearId: string,
  balances: OpeningBalance[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(accountingOpeningBalances)
      .where(
        and(
          eq(accountingOpeningBalances.workspaceSubdomain, subdomain),
          eq(accountingOpeningBalances.fiscalYearId, fiscalYearId),
        ),
      );
    if (balances.length === 0) return;
    await tx.insert(accountingOpeningBalances).values(
      balances.map((row) => ({
        id: row.id,
        workspaceSubdomain: subdomain,
        fiscalYearId,
        accountId: row.accountId,
        debit: String(row.debit ?? 0),
        credit: String(row.credit ?? 0),
      })),
    );
  });
}

export async function listBankStatements(tenant: string): Promise<BankStatement[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [statements, lines] = await Promise.all([
      tx
        .select({
          id: accountingBankStatements.id,
          accountId: accountingBankStatements.accountId,
          periodStart: accountingBankStatements.periodStart,
          periodEnd: accountingBankStatements.periodEnd,
          openingBalance: accountingBankStatements.openingBalance,
          closingBalance: accountingBankStatements.closingBalance,
          createdAt: accountingBankStatements.createdAt,
          updatedAt: accountingBankStatements.updatedAt,
        })
        .from(accountingBankStatements)
        .where(eq(accountingBankStatements.workspaceSubdomain, subdomain)),
      tx
        .select({
          id: accountingBankStatementLines.id,
          statementId: accountingBankStatementLines.statementId,
          date: accountingBankStatementLines.date,
          description: accountingBankStatementLines.description,
          amount: accountingBankStatementLines.amount,
        })
        .from(accountingBankStatementLines)
        .where(eq(accountingBankStatementLines.workspaceSubdomain, subdomain)),
    ]);
    return statements.map((statement) => ({
      id: statement.id,
      accountId: statement.accountId,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      openingBalance: Number(statement.openingBalance),
      closingBalance: Number(statement.closingBalance),
      createdAt: statement.createdAt.toISOString(),
      updatedAt: statement.updatedAt.toISOString(),
      lines: lines
        .filter((line) => line.statementId === statement.id)
        .map((line) => ({
          id: line.id,
          date: line.date,
          description: line.description,
          amount: Number(line.amount),
        })),
    }));
  });
}

export async function saveBankStatement(tenant: string, record: BankStatement): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(accountingBankStatements)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        accountId: record.accountId,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        openingBalance: String(record.openingBalance ?? 0),
        closingBalance: String(record.closingBalance ?? 0),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountingBankStatements.workspaceSubdomain, accountingBankStatements.id],
        set: {
          accountId: record.accountId,
          periodStart: record.periodStart,
          periodEnd: record.periodEnd,
          openingBalance: String(record.openingBalance ?? 0),
          closingBalance: String(record.closingBalance ?? 0),
          updatedAt: new Date(),
        },
      });
    await tx
      .delete(accountingBankStatementLines)
      .where(
        and(
          eq(accountingBankStatementLines.workspaceSubdomain, subdomain),
          eq(accountingBankStatementLines.statementId, record.id),
        ),
      );
    if (record.lines.length > 0) {
      await tx.insert(accountingBankStatementLines).values(
        record.lines.map((line) => ({
          id: line.id,
          workspaceSubdomain: subdomain,
          statementId: record.id,
          date: line.date,
          description: line.description ?? "",
          amount: String(line.amount ?? 0),
        })),
      );
    }
  });
}

export async function matchBankReconciliation(
  tenant: string,
  match: BankReconciliationMatch,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(accountingBankReconciliations)
      .values({
        workspaceSubdomain: subdomain,
        statementLineId: match.statementLineId,
        journalEntryId: match.journalEntryId,
        journalLineId: match.journalLineId,
        matchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          accountingBankReconciliations.workspaceSubdomain,
          accountingBankReconciliations.statementLineId,
        ],
        set: {
          journalEntryId: match.journalEntryId,
          journalLineId: match.journalLineId,
          matchedAt: new Date(),
        },
      });
  });
}
