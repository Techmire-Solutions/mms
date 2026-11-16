import { and, eq } from "drizzle-orm";
import { ConflictError } from "../../lib/httpErrors.js";
import { isUniqueViolation, uniqueViolationConstraint } from "../../lib/pgErrors.js";
import type { BankReconciliationMatch, BankStatement } from "@mms/shared";
import {
  accountingBankReconciliations,
  accountingBankStatementLines,
  accountingBankStatements,
} from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { requireDbDateValue } from "../../lib/dbDate.js";
import {
  auditBankReconciliationMatched,
  auditBankStatementSaved,
} from "./accountingEntityAudit.js";

/** Bank statements and reconciliation matches (split from the ledger-ops repository). */

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
      periodStart: requireDbDateValue(statement.periodStart, "periodStart"),
      periodEnd: requireDbDateValue(statement.periodEnd, "periodEnd"),
      openingBalance: Number(statement.openingBalance),
      closingBalance: Number(statement.closingBalance),
      createdAt: statement.createdAt.toISOString(),
      updatedAt: statement.updatedAt.toISOString(),
      lines: lines
        .filter((line) => line.statementId === statement.id)
        .map((line) => ({
          id: line.id,
          date: requireDbDateValue(line.date, "date"),
          description: line.description,
          amount: Number(line.amount),
        })),
    }));
  });
}

export async function saveBankStatement(tenant: string, record: BankStatement): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    // Before-state for the audit row, read inside the same transaction.
    const previous = (await listBankStatements(tenant)).find((row) => row.id === record.id) ?? null;
    await tx
      .insert(accountingBankStatements)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        accountId: record.accountId,
        periodStart: requireDbDateValue(record.periodStart, "periodStart"),
        periodEnd: requireDbDateValue(record.periodEnd, "periodEnd"),
        openingBalance: String(record.openingBalance ?? 0),
        closingBalance: String(record.closingBalance ?? 0),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountingBankStatements.workspaceSubdomain, accountingBankStatements.id],
        set: {
          accountId: record.accountId,
          periodStart: requireDbDateValue(record.periodStart, "periodStart"),
          periodEnd: requireDbDateValue(record.periodEnd, "periodEnd"),
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
          date: requireDbDateValue(line.date, "date"),
          description: line.description ?? "",
          amount: String(line.amount ?? 0),
        })),
      );
    }
    await auditBankStatementSaved(tx, subdomain, record, previous);
  });
}

export async function matchBankReconciliation(
  tenant: string,
  match: BankReconciliationMatch,
  reason?: string,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    // Re-matching the same statement line with the same journal line is an
    // idempotent replay; pointing it at a different line is a conflict. The
    // journal-line index (`accounting_bank_reconciliations_journal_line_uidx`)
    // additionally refuses consuming one line against two statements.
    const [existing] = await tx
      .select({
        journalEntryId: accountingBankReconciliations.journalEntryId,
        journalLineId: accountingBankReconciliations.journalLineId,
      })
      .from(accountingBankReconciliations)
      .where(
        and(
          eq(accountingBankReconciliations.workspaceSubdomain, subdomain),
          eq(accountingBankReconciliations.statementLineId, match.statementLineId),
        ),
      )
      .for("update");
    if (existing) {
      if (
        existing.journalEntryId === match.journalEntryId &&
        existing.journalLineId === match.journalLineId
      ) {
        return;
      }
      throw new ConflictError(
        "This statement line is already matched to a different journal line",
        "bank_line_already_matched",
      );
    }

    try {
      await tx.insert(accountingBankReconciliations).values({
        workspaceSubdomain: subdomain,
        statementLineId: match.statementLineId,
        journalEntryId: match.journalEntryId,
        journalLineId: match.journalLineId,
        matchedAt: new Date(),
      });
    } catch (error) {
      if (
        isUniqueViolation(error) &&
        (uniqueViolationConstraint(error) ?? "").includes("_journal_line_uidx")
      ) {
        throw new ConflictError(
          "This journal line is already matched",
          "journal_line_already_matched",
        );
      }
      throw error;
    }
    await auditBankReconciliationMatched(tx, subdomain, match, reason);
  });
}
