import { and, eq, inArray } from "drizzle-orm";
import { ConflictError } from "@mms/be-core/http/errors";
import { isUniqueViolation, uniqueViolationConstraint } from "@mms/be-core/http/errors";
import type { BankReconciliationMatch, BankStatement } from "@mms/contracts";
import {
  accountingBankReconciliations,
  accountingBankStatementLines,
  accountingBankStatements,
  accountingEntries,
  accountingJournalLines,
} from "@mms/db/schema";
import { withTenant, withTenantRead } from "@mms/db/context";
import { requireDbDateValue } from "./dbDate.js";
import {
  auditBankReconciliationMatched,
  auditBankStatementSaved,
} from "./accountingEntityAudit.js";
import { bankStatementContentHash } from "./accountingBankStatementIdentity.js";

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
    if (previous) {
      // Re-importing a statement whose lines are already matched would
      // delete-and-reinsert those lines and orphan the match rows. Refuse unless
      // the incoming content is byte-for-byte the same (an idempotent replay).
      const lineIds = previous.lines.map((line) => line.id);
      if (lineIds.length > 0) {
        const [matched] = await tx
          .select({ statementLineId: accountingBankReconciliations.statementLineId })
          .from(accountingBankReconciliations)
          .where(
            and(
              eq(accountingBankReconciliations.workspaceSubdomain, subdomain),
              inArray(accountingBankReconciliations.statementLineId, lineIds),
            ),
          )
          .limit(1);
        if (matched && bankStatementContentHash(previous) !== bankStatementContentHash(record)) {
          throw new ConflictError(
            "This statement has reconciliation matches — unmatch its lines before re-importing",
            "bank_statement_reconciled",
          );
        }
      }
    }
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
        currency: record.currency ?? null,
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
          currency: record.currency ?? null,
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

/** Why a bank-reconciliation match is ineligible, or null when it may proceed. */
export function bankReconciliationMatchError(input: {
  statementLineExists: boolean;
  statementAccountId: string;
  entryStatus: string | null;
  journalLineAccountId: string | null;
}): string | null {
  if (!input.statementLineExists) return "bank_line_not_found";
  if (input.entryStatus !== "posted") return "entry_not_posted";
  if (input.journalLineAccountId == null) return "journal_line_not_found";
  if (input.journalLineAccountId !== input.statementAccountId) return "account_mismatch";
  return null;
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

    // Eligibility: the statement line must exist in this tenant and the journal
    // line must be posted and sit on the statement's own bank account. Without
    // this, a draft, a foreign-account line, or a bogus statement-line id could
    // be matched.
    const [statementLine] = await tx
      .select({ statementId: accountingBankStatementLines.statementId })
      .from(accountingBankStatementLines)
      .where(
        and(
          eq(accountingBankStatementLines.workspaceSubdomain, subdomain),
          eq(accountingBankStatementLines.id, match.statementLineId),
        ),
      )
      .limit(1);
    let statementAccountId = "";
    if (statementLine) {
      const [statement] = await tx
        .select({ accountId: accountingBankStatements.accountId })
        .from(accountingBankStatements)
        .where(
          and(
            eq(accountingBankStatements.workspaceSubdomain, subdomain),
            eq(accountingBankStatements.id, statementLine.statementId),
          ),
        )
        .limit(1);
      statementAccountId = statement?.accountId ?? "";
    }
    const [entry] = await tx
      .select({ status: accountingEntries.status })
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, subdomain),
          eq(accountingEntries.id, match.journalEntryId),
        ),
      )
      .limit(1);
    const [journalLine] = await tx
      .select({ accountId: accountingJournalLines.accountId })
      .from(accountingJournalLines)
      .where(
        and(
          eq(accountingJournalLines.workspaceSubdomain, subdomain),
          eq(accountingJournalLines.entryId, match.journalEntryId),
          eq(accountingJournalLines.id, match.journalLineId),
        ),
      )
      .limit(1);

    const eligibilityError = bankReconciliationMatchError({
      statementLineExists: Boolean(statementLine),
      statementAccountId,
      entryStatus: entry?.status ?? null,
      journalLineAccountId: journalLine?.accountId ?? null,
    });
    if (eligibilityError) {
      const message =
        eligibilityError === "bank_line_not_found"
          ? "The statement line does not exist"
          : eligibilityError === "entry_not_posted"
            ? "Only posted journal lines can be reconciled"
            : eligibilityError === "account_mismatch"
              ? "The journal line must belong to the statement's bank account"
              : "The journal line does not exist";
      throw new ConflictError(message, eligibilityError);
    }

    try {
      await tx.insert(accountingBankReconciliations).values({
        workspaceSubdomain: subdomain,
        statementLineId: match.statementLineId,
        statementId: statementLine?.statementId ?? null,
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
