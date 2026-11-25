/**
 * App-bound ports for the billing (finance) module.
 *
 * The accounting ledger, enrollments repository, contacts reads, hasanat
 * student lookup, CSV-export job runner, field-config/preferences services and
 * the reciprocal accounting->finance binding stay in the app; the composition
 * root binds them in `apps/api/src/modules/billing/adapters.ts`.
 */
export interface FinanceAccountingPort {
  findEntryIdBySource(...args: any[]): Promise<any>;
  tryPostInvoiceJournal(...args: any[]): Promise<any>;
  tryPostInvoiceJournals(...args: any[]): Promise<any>;
  tryPostPaymentJournal(...args: any[]): Promise<any>;
  tryPostArchiveReversalJournal(...args: any[]): Promise<any>;
  tryPostRestoreJournal(...args: any[]): Promise<any>;
  tryPostCreditNoteJournal(...args: any[]): Promise<any>;
  tryPostInvoiceReversalJournal(...args: any[]): Promise<any>;
  tryPostLateFeeJournals(...args: any[]): Promise<any>;
  tryPostLateFeeReversalJournal(...args: any[]): Promise<any>;
  getPostingRules(...args: any[]): Promise<any>;
  accountingFxRepository: any;
  lookupExchangeRate(...args: any[]): Promise<any>;
  listRealizedFxByCurrency(...args: any[]): Promise<any>;
  upsertExchangeRates(...args: any[]): Promise<any>;
  upsertEntriesHelper(...args: any[]): Promise<any>;
  upsertVoucherNumbering(...args: any[]): Promise<any>;
  accountingUseCases: any;
  findEntryById(...args: any[]): Promise<any>;
  findAccountById(...args: any[]): Promise<any>;
  allocateVoucherNumbers(...args: any[]): Promise<any>;
  accountingRepository: any;
}

export interface FinanceEnrollmentPort {
  linkEnrollmentInvoiceIds(...args: any[]): Promise<any>;
  findEnrollmentById(...args: any[]): Promise<any>;
}

export interface FinanceContactsPort {
  loadContactsSummaryByIdsForTenant(...args: any[]): Promise<any>;
  loadContactFieldConfig(...args: any[]): Promise<any>;
}

export interface FinanceHasanatPort {
  findStudentsByNames(...args: any[]): Promise<any>;
  findStudentsByIds(...args: any[]): Promise<any>;
}

export interface FinanceJobsPort {
  enqueueCsvExportJob(...args: any[]): Promise<any>;
  normalizeExportQuery(...args: any[]): any;
  enqueueBackgroundJob(...args: any[]): Promise<any>;
  getUserBackgroundJob(...args: any[]): Promise<any>;
  getUserBackgroundJobPayload(...args: any[]): Promise<any>;
  retryFailedBackgroundJob(...args: any[]): Promise<any>;
  hasBackgroundJobRunner(jobId: string): boolean;
  isBackgroundJobLimitError(error: unknown): boolean;
  isQueueUnavailableError(error: unknown): boolean;
}

export interface FinanceSessionsPort {
  loadSessionClassRefTx(...args: any[]): Promise<any>;
  sessionHasEnrollments(...args: any[]): Promise<any>;
}

export interface FinanceLegalPort {
  registerModuleCsvExportJobRunner(options: Record<string, unknown>): void;
}

export interface FinancePorts
  extends
    FinanceAccountingPort,
    FinanceEnrollmentPort,
    FinanceContactsPort,
    FinanceHasanatPort,
    FinanceJobsPort,
    FinanceSessionsPort,
    FinanceLegalPort {}
