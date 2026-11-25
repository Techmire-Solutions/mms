import type { FinancePorts } from "./ports.js";

let ports: FinancePorts | null = null;

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureFinancePorts(next: FinancePorts): void {
  ports = next;
}

function requirePorts(): FinancePorts {
  if (!ports) throw new Error("Finance ports are not configured (call configureFinancePorts)");
  return ports;
}

export function findEntryIdBySource(...args: any[]): Promise<any> {
  return requirePorts().findEntryIdBySource(...args);
}
export function tryPostInvoiceJournal(...args: any[]): Promise<any> {
  return requirePorts().tryPostInvoiceJournal(...args);
}
export function tryPostInvoiceJournals(...args: any[]): Promise<any> {
  return requirePorts().tryPostInvoiceJournals(...args);
}
export function tryPostPaymentJournal(...args: any[]): Promise<any> {
  return requirePorts().tryPostPaymentJournal(...args);
}
export function tryPostArchiveReversalJournal(...args: any[]): Promise<any> {
  return requirePorts().tryPostArchiveReversalJournal(...args);
}
export function tryPostRestoreJournal(...args: any[]): Promise<any> {
  return requirePorts().tryPostRestoreJournal(...args);
}
export function tryPostCreditNoteJournal(...args: any[]): Promise<any> {
  return requirePorts().tryPostCreditNoteJournal(...args);
}
export function tryPostInvoiceReversalJournal(...args: any[]): Promise<any> {
  return requirePorts().tryPostInvoiceReversalJournal(...args);
}
export function tryPostLateFeeJournals(...args: any[]): Promise<any> {
  return requirePorts().tryPostLateFeeJournals(...args);
}
export function tryPostLateFeeReversalJournal(...args: any[]): Promise<any> {
  return requirePorts().tryPostLateFeeReversalJournal(...args);
}
export function getPostingRules(...args: any[]): Promise<any> {
  return requirePorts().getPostingRules(...args);
}
export function linkEnrollmentInvoiceIds(...args: any[]): Promise<any> {
  return requirePorts().linkEnrollmentInvoiceIds(...args);
}
export function loadContactsSummaryByIdsForTenant(...args: any[]): Promise<any> {
  return requirePorts().loadContactsSummaryByIdsForTenant(...args);
}
export function loadContactFieldConfig(...args: any[]): Promise<any> {
  return requirePorts().loadContactFieldConfig(...args);
}
export function findStudentsByNames(...args: any[]): Promise<any> {
  return requirePorts().findStudentsByNames(...args);
}
export const accountingUseCases: any = new Proxy(
  {},
  {
    get:
      (_target, prop) =>
      (...args: any[]) =>
        (requirePorts().accountingUseCases as any)[prop](...args),
  },
);

export const accountingRepository: any = new Proxy(
  {},
  {
    get:
      (_target, prop) =>
      (...args: any[]) =>
        (requirePorts().accountingRepository as any)[prop](...args),
  },
);

export const accountingFxRepository: any = new Proxy(
  {},
  {
    get:
      (_target, prop) =>
      (...args: any[]) =>
        (requirePorts().accountingFxRepository as any)[prop](...args),
  },
);

export function getAccountingFxRepository(): any {
  return requirePorts().accountingFxRepository;
}
export type AccountingFxRepository = any;
export function findEnrollmentById(...args: any[]): Promise<any> {
  return requirePorts().findEnrollmentById(...args);
}
export function findStudentsByIds(...args: any[]): Promise<any> {
  return requirePorts().findStudentsByIds(...args);
}
export function enqueueCsvExportJob(...args: any[]): any {
  return requirePorts().enqueueCsvExportJob(...args);
}
export function normalizeExportQuery(...args: any[]): any {
  return requirePorts().normalizeExportQuery(...args);
}
export function enqueueBackgroundJob(...args: any[]): any {
  return requirePorts().enqueueBackgroundJob(...args);
}
export function getUserBackgroundJob(...args: any[]): any {
  return requirePorts().getUserBackgroundJob(...args);
}
export function getUserBackgroundJobPayload(...args: any[]): any {
  return requirePorts().getUserBackgroundJobPayload(...args);
}
export function retryFailedBackgroundJob(...args: any[]): any {
  return requirePorts().retryFailedBackgroundJob(...args);
}
export function loadSessionClassRefTx(...args: any[]): any {
  return requirePorts().loadSessionClassRefTx(...args);
}
export function hasBackgroundJobRunner(jobId: string): boolean {
  return requirePorts().hasBackgroundJobRunner(jobId);
}
export function isBackgroundJobLimitError(error: unknown): boolean {
  return requirePorts().isBackgroundJobLimitError(error);
}
export function isQueueUnavailableError(error: unknown): boolean {
  return requirePorts().isQueueUnavailableError(error);
}
export function sessionHasEnrollments(...args: any[]): Promise<any> {
  return requirePorts().sessionHasEnrollments(...args);
}
export function lookupExchangeRate(...args: any[]): Promise<any> {
  return requirePorts().lookupExchangeRate(...args);
}
export function listRealizedFxByCurrency(...args: any[]): Promise<any> {
  return requirePorts().listRealizedFxByCurrency(...args);
}
export function upsertExchangeRates(...args: any[]): Promise<any> {
  return requirePorts().upsertExchangeRates(...args);
}
export function findEntryById(...args: any[]): Promise<any> {
  return requirePorts().findEntryById(...args);
}
export function findAccountById(...args: any[]): Promise<any> {
  return requirePorts().findAccountById(...args);
}
export function allocateVoucherNumbers(...args: any[]): Promise<any> {
  return requirePorts().allocateVoucherNumbers(...args);
}
export function upsertEntriesHelper(...args: any[]): Promise<any> {
  return requirePorts().upsertEntriesHelper(...args);
}
export function upsertVoucherNumbering(...args: any[]): Promise<any> {
  return requirePorts().upsertVoucherNumbering(...args);
}
export function registerModuleCsvExportJobRunner(options: Record<string, unknown>): void {
  requirePorts().registerModuleCsvExportJobRunner(options);
}
