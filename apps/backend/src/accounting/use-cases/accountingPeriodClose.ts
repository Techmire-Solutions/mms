import {
  buildClosingEntryLines,
  moneyToCents,
  type FiscalYear,
  type JournalEntry,
} from "@mms/shared";
import { findEntryIdBySource, saveEntry } from "../../db/repositories/accountingRepository.js";
import {
  findFiscalYearByIdForUpdate,
  listFiscalYearsByWorkspace,
  saveFiscalYear,
} from "../../db/repositories/accountingFiscalYearsRepository.js";
import { aggregateAccountingReport } from "../../db/repositories/accountingRepositoryReport.js";
import { getAccountingPreferencesService } from "../../services/accountingPreferencesService.js";
import {
  assertJournalAccountsWritable,
  prepareJournalEntryForPersist,
} from "./accountingLedgerGuards.js";
import {
  findAccountById,
  lockPostableAccounts,
} from "../../db/repositories/accountingAccountsRepository.js";
import { getCurrencySettings } from "../../db/repositories/accountingCurrencySettingsRepository.js";
import {
  hasFxRevaluationBetween,
  listForeignMonetaryBalances,
} from "../../db/repositories/accountingFxRevaluationRepository.js";
import { listHedgeRelationships } from "../../db/repositories/accountingHedgesRepository.js";
import {
  findIas29RunId,
  getHyperinflationSettings,
} from "../../db/repositories/accountingHyperinflationRepository.js";
import { withTenant } from "../../db/tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { ACCOUNTING_ERROR_CODES } from "@mms/shared";
import { lockFiscalYearForPosting } from "../ledgerPosting/fiscalYearPostingLock.js";
import { ledgerError } from "./accountingLedgerErrors.js";

/**
 * IFRS 9: a hedge's fair value and OCI reserve are only on the books on their
 * valuation date — every valuation is reversed the next day — so a year closed
 * without a closing-date valuation reports no hedge position at all.
 */
async function assertYearEndHedgesValued(tenant: string, endDate: string): Promise<void> {
  const hedges = await listHedgeRelationships(tenant);
  const missing = hedges.filter(
    (hedge) =>
      hedge.status === "active" &&
      hedge.designationDate <= endDate &&
      endDate <= hedge.maturityDate &&
      !hedge.valuations.some(
        (record) => record.kind === "valuation" && record.valuationDate === endDate,
      ),
  );
  if (missing.length > 0) {
    throw ledgerError(
      `Post the year-end hedge valuation for ${endDate} first: ${missing
        .map((hedge) => hedge.name)
        .join(", ")}`,
      ACCOUNTING_ERROR_CODES.yearCloseBlocked,
    );
  }
}

/**
 * IAS 29: the restatement is reversed the next day like a valuation, so the
 * closing-date restatement must exist before the year closes.
 */
async function assertYearEndRestated(tenant: string, endDate: string): Promise<void> {
  const settings = await getHyperinflationSettings(tenant);
  if (!settings.enabled) return;
  if (settings.appliesFrom && endDate < settings.appliesFrom) return;
  if (await findIas29RunId(tenant, endDate)) return;
  throw ledgerError(
    `Post the IAS 29 restatement for ${endDate} before closing: the functional currency is hyperinflationary`,
    ACCOUNTING_ERROR_CODES.yearCloseBlocked,
  );
}

/**
 * IAS 21.23: foreign monetary balances must be retranslated at the closing rate
 * before the books close, or the year's P&L omits the unrealized FX difference.
 */
async function assertYearEndRevalued(tenant: string, endDate: string): Promise<void> {
  const { functionalCurrency } = await getCurrencySettings(tenant);
  const balances = await listForeignMonetaryBalances(tenant, endDate, functionalCurrency);
  if (balances.length === 0) return;
  if (await hasFxRevaluationBetween(tenant, endDate, endDate)) return;
  throw ledgerError(
    `Post the period-end FX revaluation for ${endDate} before closing: foreign-currency balances are open`,
  );
}

export async function closeFiscalYearForTenant(
  tenant: string,
  fiscalYearId: string,
  closedBy: string,
  retainedEarningsAccountId?: string,
): Promise<FiscalYear> {
  return withTenant(tenant, async () => {
    // The row lock serialises two close attempts; the advisory lock is the one
    // posting paths also take, so an entry cannot commit between the aggregate
    // read below and the `status = 'closed'` write.
    const year = await findFiscalYearByIdForUpdate(tenant, fiscalYearId);
    if (!year)
      throw Object.assign(new Error("Fiscal year not found"), {
        statusCode: 404,
        type: "not_found",
      });
    if (year.status === "closed")
      throw ledgerError("Fiscal year is already closed", ACCOUNTING_ERROR_CODES.yearClosed);
    await lockFiscalYearForPosting(tenant, [year.id]);
    const years = await listFiscalYearsByWorkspace(tenant);

    const prefs = await getAccountingPreferencesService();
    const retainedEarnings =
      retainedEarningsAccountId?.trim() || prefs?.retainedEarningsAccount?.trim() || "";
    if (!retainedEarnings) {
      throw ledgerError("Retained earnings account is required to close a fiscal year");
    }
    const account = await findAccountById(tenant, retainedEarnings);
    if (!account || account.deletedAt || !account.isActive || account.type !== "Equity") {
      throw ledgerError(
        "Retained earnings must reference an active Equity account",
        ACCOUNTING_ERROR_CODES.accountNotPostable,
      );
    }

    await assertYearEndRevalued(tenant, year.endDate);
    // Same rule for the other two standards whose postings are auto-reversed: the
    // year must close with the hedge fair value/OCI reserve and the IAS 29
    // restatement actually on the books.
    await assertYearEndHedgesValued(tenant, year.endDate);
    await assertYearEndRestated(tenant, year.endDate);

    const report = await aggregateAccountingReport(tenant, {
      dateFrom: year.startDate,
      dateTo: year.endDate,
    });
    // Never close a year whose own ledger does not balance: the closing entry
    // plugs P&L into retained earnings, so an unbalanced trial balance would be
    // silently absorbed by that plug instead of failing loudly.
    const debitCents = report.trialBalance.reduce(
      (sum, row) => sum + moneyToCents(row.totalDebit),
      0,
    );
    const creditCents = report.trialBalance.reduce(
      (sum, row) => sum + moneyToCents(row.totalCredit),
      0,
    );
    if (debitCents !== creditCents) {
      throw ledgerError(
        `Trial balance does not balance for ${year.label}: ${(debitCents / 100).toFixed(2)} debit vs ${(creditCents / 100).toFixed(2)} credit — run audit:ledger-balance`,
      );
    }
    const balances = report.trialBalance
      .filter((row) => row.type === "Revenue" || row.type === "Expense")
      .map((row) => ({
        accountId: row.id,
        type: row.type as "Revenue" | "Expense",
        net: row.balance,
      }));
    const lines = buildClosingEntryLines(retainedEarnings, balances);
    if (!lines && balances.some((row) => row.net !== 0)) {
      throw ledgerError("Unable to produce a balanced closing entry for this fiscal year");
    }
    let closingEntryId: string | null = null;
    if (lines) {
      const existingId = await findEntryIdBySource(tenant, "closing", fiscalYearId);
      if (!existingId) {
        const entry: JournalEntry = {
          id: `je-closing-${fiscalYearId}`,
          date: year.endDate,
          ref: `closing:${fiscalYearId}`,
          description: `Close ${year.label}`,
          status: "posted",
          created_by: closedBy,
          tags: [],
          attachments: [],
          fiscal_year: year.label,
          fiscal_year_id: year.id,
          source_type: "closing",
          source_id: fiscalYearId,
          lines,
        };
        // The close writes ledger rows directly; run the same postability guard the
        // manual paths use so a deactivated/archived/summary P&L account (legacy
        // data) cannot be closed into.
        await assertJournalAccountsWritable(tenant, [entry], lockPostableAccounts);
        await saveEntry(tenant, prepareJournalEntryForPersist(entry, years));
        closingEntryId = entry.id;
      } else {
        closingEntryId = existingId;
      }
    }

    const closed: FiscalYear = {
      ...year,
      status: "closed",
      closedAt: new Date().toISOString(),
      closedBy,
    };
    await saveFiscalYear(tenant, closed);
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "accounting_fiscal_years",
      recordId: year.id,
      actionType: "UPDATE",
      oldState: { id: year.id, status: year.status, endDate: year.endDate },
      newState: {
        id: closed.id,
        status: closed.status,
        endDate: closed.endDate,
        closedAt: closed.closedAt,
        closingEntryId,
      },
    });
    return closed;
  });
}
