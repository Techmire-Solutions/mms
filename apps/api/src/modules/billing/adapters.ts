/**
 * Composition adapter for the billing (finance) module.
 *
 * Binds the module's kernel ports to the app-only services it may not import:
 * the accounting ledger/posting it consumes, the reciprocal accounting->finance
 * port, enrollments/students/sessions repositories, contacts reads, hasanat
 * student lookup, CSV export enqueue helpers and background-job plumbing.
 */
import { configureFinancePorts } from "@mms/mod-billing/backend/deps";
import { financeUseCases } from "@mms/mod-billing/backend/use-cases";
import {
  allocateVoucherNumbers,
  accountingFxRepository,
  accountingRepository,
  findAccountById,
  findEntryById,
  findEntryIdBySource,
  getPostingRules,
  listRealizedFxByCurrency,
  lookupExchangeRate,
  upsertExchangeRates,
} from "@mms/mod-accounting/backend/repository";
import {
  tryPostArchiveReversalJournal,
  tryPostCreditNoteJournal,
  tryPostInvoiceJournal,
  tryPostInvoiceJournals,
  tryPostInvoiceReversalJournal,
  tryPostLateFeeJournals,
  tryPostLateFeeReversalJournal,
  tryPostPaymentJournal,
  tryPostRestoreJournal,
} from "@mms/mod-accounting/backend/ledger-posting";
import {
  accountingUseCases,
  upsertEntriesHelper,
  upsertVoucherNumbering,
} from "@mms/mod-accounting/backend/use-cases";
import { configureAccountingFinancePort } from "@mms/mod-accounting/backend/tenant";
import { linkEnrollmentInvoiceIds } from "@mms/mod-enrollments/backend/repository";
import { findEnrollmentById } from "@mms/mod-enrollments/backend/repository";
import { findStudentsByIds } from "@mms/mod-students/backend/repository";
import { loadSessionClassRefTx } from "@mms/mod-sessions/backend/repository";
import { sessionHasEnrollments } from "@mms/mod-sessions/backend/repository";
import { loadContactsSummaryByIdsForTenant } from "@mms/mod-contacts/backend/services";
import { loadContactFieldConfig } from "@mms/mod-contacts/backend/use-cases";
import { findStudentsByNames } from "@mms/mod-hasanat/backend/repository";
import { enqueueCsvExportJob, normalizeExportQuery } from "../../lib/csvExportEnqueue.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
  hasBackgroundJobRunner,
  retryFailedBackgroundJob,
} from "../../services/backgroundJobWorkerService.js";
import {
  BackgroundJobLimitError,
  QueueUnavailableError,
} from "../../services/backgroundJobWorkerService.js";
import { registerModuleCsvExportJobRunner } from "../../lib/registerModuleCsvExportJobRunner.js";

export function configureBillingAdapters(): void {
  configureFinancePorts({
    findEntryIdBySource,
    tryPostInvoiceJournal,
    tryPostInvoiceJournals,
    tryPostPaymentJournal,
    tryPostArchiveReversalJournal,
    tryPostRestoreJournal,
    tryPostCreditNoteJournal,
    tryPostInvoiceReversalJournal,
    tryPostLateFeeJournals,
    tryPostLateFeeReversalJournal,
    getPostingRules,
    accountingFxRepository,
    lookupExchangeRate,
    listRealizedFxByCurrency,
    upsertExchangeRates,
    findEntryById,
    findAccountById,
    allocateVoucherNumbers,
    upsertEntriesHelper,
    upsertVoucherNumbering,
    accountingRepository,
    accountingUseCases,
    linkEnrollmentInvoiceIds,
    findEnrollmentById,
    loadContactsSummaryByIdsForTenant,
    loadContactFieldConfig,
    findStudentsByNames,
    findStudentsByIds,
    enqueueCsvExportJob,
    normalizeExportQuery,
    enqueueBackgroundJob,
    getUserBackgroundJob,
    getUserBackgroundJobPayload,
    retryFailedBackgroundJob,
    hasBackgroundJobRunner,
    isBackgroundJobLimitError: (error: unknown) => error instanceof BackgroundJobLimitError,
    isQueueUnavailableError: (error: unknown) => error instanceof QueueUnavailableError,
    loadSessionClassRefTx,
    sessionHasEnrollments,
    registerModuleCsvExportJobRunner: (options) =>
      registerModuleCsvExportJobRunner(
        options as Parameters<typeof registerModuleCsvExportJobRunner>[0],
      ),
  });

  // Accounting -> finance: the reciprocal direction stays composed at the app root.
  configureAccountingFinancePort({
    createInvoice: (input: Record<string, unknown>) =>
      financeUseCases.createInvoice(input as never),
    createPayment: (input: Record<string, unknown>) =>
      financeUseCases.createPayment(input as never),
  });
}
