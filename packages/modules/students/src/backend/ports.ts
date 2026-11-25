/**
 * App-bound ports for the students module.
 *
 * Contacts reconciliation, enrollment withdrawal/cascade, CSV export job
 * enqueue and the background-job plumbing stay in the app; the composition root
 * binds them in `apps/api/src/modules/students/adapters.ts`.
 */
export interface StudentContactsPort {
  upsertContact(...args: any[]): Promise<any>;
  findContactsMatchingUniqueValues(...args: any[]): Promise<any>;
  reconcileContactSystemTags(...args: any[]): Promise<any>;
  loadContactsByIdsForTenant(...args: any[]): Promise<any>;
  loadContactsSummaryByIdsForTenant(...args: any[]): Promise<any>;
}

export interface StudentEnrollmentsPort {
  withdrawEnrollmentsForStudentStatus(...args: any[]): Promise<any>;
  bulkEnrollStudentsIntoClass(...args: any[]): Promise<any>;
}

export interface StudentAccessPort {
  getModuleAccessDenial(...args: any[]): Promise<any>;
}

export interface StudentJobsPort {
  enqueueCsvExportJob(...args: any[]): Promise<any>;
  normalizeExportQuery(...args: any[]): any;
  enqueueBackgroundJob(...args: any[]): Promise<any>;
  getUserBackgroundJob(...args: any[]): Promise<any>;
  getUserBackgroundJobPayload(...args: any[]): Promise<any>;
  retryFailedBackgroundJob(...args: any[]): Promise<any>;
  hasBackgroundJobRunner(jobId: string): boolean;
  isBackgroundJobLimitError(error: unknown): boolean;
  isQueueUnavailableError(error: unknown): boolean;
  registerModuleCsvExportJobRunner(options: Record<string, unknown>): void;
}

export interface StudentPorts
  extends StudentContactsPort, StudentEnrollmentsPort, StudentAccessPort, StudentJobsPort {}
