import type { AccountingRepository } from "./accountingRepositoryTypes.js";
import { accountingFxRepository } from "./accountingFxRepositoryAdapter.js";
import { lockJournalEntries } from "./accountingEntryLocks.js";
import { allocateVoucherNumbers } from "./accountingVoucherRepository.js";
import {
  findClosedPostingPeriodForDate,
  findPostingPeriodById,
  listPostingPeriods,
  setPostingPeriodStatus,
} from "./accountingPostingPeriodsRepository.js";
import {
  listAccountsByWorkspace,
  findAccountById,
  findAccountsByIds,
  lockPostableAccounts,
  saveAccount,
  bulkSaveAccounts,
  replaceAccountsForWorkspace,
  listEntriesByWorkspace,
  findEntryById,
  findEntryByRef,
  findActiveEntryRefs,
  findEntriesByIds,
  saveEntry,
  bulkSaveEntries,
  replaceEntriesForWorkspace,
  listFiscalYearsByWorkspace,
  findFiscalYearById,
  findFiscalYearsByIds,
  saveFiscalYear,
  bulkSaveFiscalYears,
  replaceFiscalYearsForWorkspace,
  bulkSoftDeleteAccounts,
  bulkRestoreAccounts,
  bulkSoftDeleteEntries,
  bulkRestoreEntries,
} from "./accountingRepository.js";
import { listAccountsPage, listFiscalYearsPage } from "./accountingRepositoryListPages.js";
import { listEntriesPage } from "./accountingRepositoryListEntries.js";
import { aggregateAccountingCommandMetrics } from "./accountingRepositoryMetrics.js";
import { aggregateAccountingReport } from "./accountingRepositoryReport.js";

/**
 * Drizzle-backed adapter for {@link AccountingRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const accountingRepository: AccountingRepository = {
  lockJournalEntries,
  listAccountsByWorkspace,
  findAccountById,
  findAccountsByIds,
  lockPostableAccounts,
  saveAccount,
  bulkSaveAccounts,
  replaceAccountsForWorkspace,
  listAccountsPage,
  listEntriesByWorkspace,
  findEntryById,
  findEntryByRef,
  findActiveEntryRefs,
  allocateVoucherNumbers,
  findEntriesByIds,
  findClosedPostingPeriodForDate,
  listPostingPeriods,
  findPostingPeriodById,
  setPostingPeriodStatus,
  saveEntry,
  bulkSaveEntries,
  replaceEntriesForWorkspace,
  listEntriesPage,
  listFiscalYearsByWorkspace,
  findFiscalYearById,
  findFiscalYearsByIds,
  saveFiscalYear,
  bulkSaveFiscalYears,
  replaceFiscalYearsForWorkspace,
  listFiscalYearsPage,
  aggregateAccountingCommandMetrics,
  aggregateAccountingReport,
  bulkSoftDeleteAccounts,
  bulkRestoreAccounts,
  bulkSoftDeleteEntries,
  bulkRestoreEntries,
  fx: accountingFxRepository,
};
