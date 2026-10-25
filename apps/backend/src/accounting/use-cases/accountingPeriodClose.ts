import { buildClosingEntryLines, type FiscalYear, type JournalEntry } from "@mms/shared";
import { findEntryIdBySource, saveEntry } from "../../db/repositories/accountingRepository.js";
import {
  listFiscalYearsByWorkspace,
  saveFiscalYear,
} from "../../db/repositories/accountingFiscalYearsRepository.js";
import { aggregateAccountingReport } from "../../db/repositories/accountingRepositoryReport.js";
import { getAccountingPreferencesService } from "../../services/accountingPreferencesService.js";
import { prepareJournalEntryForPersist } from "./accountingLedgerGuards.js";
import { findAccountById } from "../../db/repositories/accountingAccountsRepository.js";
import { getCurrencySettings } from "../../db/repositories/accountingCurrencySettingsRepository.js";
import {
  hasFxRevaluationBetween,
  listForeignMonetaryBalances,
} from "../../db/repositories/accountingFxRevaluationRepository.js";

function ledgerError(
  message: string,
  statusCode = 422,
): Error & { statusCode: number; type: string } {
  return Object.assign(new Error(message), { statusCode, type: "validation_error" });
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
  const years = await listFiscalYearsByWorkspace(tenant);
  const year = years.find((row) => row.id === fiscalYearId);
  if (!year)
    throw Object.assign(new Error("Fiscal year not found"), { statusCode: 404, type: "not_found" });
  if (year.status === "closed") throw ledgerError("Fiscal year is already closed");

  const prefs = await getAccountingPreferencesService();
  const retainedEarnings =
    retainedEarningsAccountId?.trim() || prefs?.retainedEarningsAccount?.trim() || "";
  if (!retainedEarnings) {
    throw ledgerError("Retained earnings account is required to close a fiscal year");
  }
  const account = await findAccountById(tenant, retainedEarnings);
  if (!account || account.deletedAt || !account.isActive || account.type !== "Equity") {
    throw ledgerError("Retained earnings must reference an active Equity account");
  }

  await assertYearEndRevalued(tenant, year.endDate);

  const report = await aggregateAccountingReport(tenant, {
    dateFrom: year.startDate,
    dateTo: year.endDate,
  });
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
      await saveEntry(tenant, prepareJournalEntryForPersist(entry, years));
    }
  }

  const closed: FiscalYear = {
    ...year,
    status: "closed",
    closedAt: new Date().toISOString(),
    closedBy,
  };
  await saveFiscalYear(tenant, closed);
  return closed;
}
