import type { AccountingRepository } from "./accountingRepository.js";
import { accountingFxRepository } from "./accountingFxRepositoryAdapter.js";
import { lockJournalEntries } from "../../db/repositories/accountingEntryLocks.js";
import { allocateVoucherNumbers } from "../../db/repositories/accountingVoucherRepository.js";
import {
  listAccountsByWorkspace,
  findAccountById,
  findAccountsByIds,
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
} from "../../db/repositories/accountingRepository.js";
import {
  listAccountsPage,
  listFiscalYearsPage,
} from "../../db/repositories/accountingRepositoryListPages.js";
import { listEntriesPage } from "../../db/repositories/accountingRepositoryListEntries.js";
import { aggregateAccountingCommandMetrics } from "../../db/repositories/accountingRepositoryMetrics.js";
import { aggregateAccountingReport } from "../../db/repositories/accountingRepositoryReport.js";

/**
 * Drizzle-backed adapter for {@link AccountingRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const accountingRepository: AccountingRepository = {
  lockJournalEntries,
  listAccountsByWorkspace,
  findAccountById,
  findAccountsByIds,
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
