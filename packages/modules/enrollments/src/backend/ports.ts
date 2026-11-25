/**
 * App-bound ports for the enrollments module.
 *
 * Sessions/students/contacts/notifications/billing modules, workspace timezone,
 * SMS transport and background-job plumbing stay in the app; the composition
 * root binds them in `apps/api/src/modules/enrollments/adapters.ts`.
 */
export interface EnrollmentsSessionsPort {
  findRegistrationLinkBySlugTx(...args: any[]): Promise<any>;
  findSessionById(...args: any[]): Promise<any>;
  findSessionsByIds(...args: any[]): Promise<any>;
  getSessionModulePreferencesByWorkspace(...args: any[]): Promise<any>;
  listActiveRegistrationLinksTx(...args: any[]): Promise<any>;
  lockRegistrationLinkTx(...args: any[]): Promise<any>;
  syncEnrolledSessionsTx(...args: any[]): Promise<any>;
  syncPlacementsTx(...args: any[]): Promise<any>;
  enrollmentHoldsSeatSql(...args: any[]): any;
  saveSession(...args: any[]): Promise<any>;
  registrationLinkUseCases: any;
  bulkSoftDeleteStudentsSql: any;
  bulkSaveInvoices: any;
  transitionSession: any;
  restoreSessionWithCascade(...args: any[]): Promise<any>;
  softDeleteSessionWithCascade(...args: any[]): Promise<any>;
  restoreCascadedEnrollmentsForStudents(...args: any[]): Promise<any>;
  cascadeSoftDeleteEnrollmentsForStudents(...args: any[]): Promise<any>;
  enrollmentHoldsSeatWhere(...args: any[]): any;
  closePlacementTx(...args: any[]): Promise<any>;
  insertTypedTimelineEventTx(...args: any[]): Promise<any>;
  movePlacementTx(...args: any[]): Promise<any>;
  lockAndAssertTargetSectionTx(...args: any[]): Promise<any>;
  countLiveSeatsByClassTx(...args: any[]): Promise<any>;
  countLiveSeatsBySectionTx(...args: any[]): Promise<any>;
  loadEnrollmentSeatHoldersTx(...args: any[]): Promise<any>;
  lockSectionsForSeatsTx(...args: any[]): Promise<any>;
  lockRolloverCarryTx(...args: any[]): Promise<any>;
  recordEnrollmentSuspension(...args: any[]): Promise<any>;
  appendClientTimelineTx(...args: any[]): Promise<any>;
}

export interface EnrollmentsStudentsPort {
  findStudentById(...args: any[]): Promise<any>;
  findStudentsByIds(...args: any[]): Promise<any>;
  createStudent(...args: any[]): Promise<any>;
}

export interface EnrollmentsContactsPort {
  upsertContact(...args: any[]): Promise<any>;
}

export interface EnrollmentsNotificationsPort {
  notificationsUseCases: any;
}

export interface EnrollmentsBillingPort {
  settleEnrollmentWithdrawal(...args: any[]): Promise<any>;
  maybeGenerateInvoiceForEnrollment(...args: any[]): Promise<any>;
}

export interface EnrollmentsAttendancePort {
  recordApprovedLeave(...args: any[]): Promise<any>;
  getWorkspaceBySubdomain(...args: any[]): Promise<any>;
  fetchPublicBrandingForSubdomain?(...args: any[]): Promise<any>;
  findWorkspaceTimezone(...args: any[]): Promise<any>;
}

export interface EnrollmentsJobsPort {
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

export interface EnrollmentsTransportPort {
  sendTenantSms(...args: any[]): Promise<any>;
  sendTenantWhatsApp(...args: any[]): Promise<any>;
}

export interface EnrollmentsPorts
  extends
    EnrollmentsSessionsPort,
    EnrollmentsStudentsPort,
    EnrollmentsContactsPort,
    EnrollmentsNotificationsPort,
    EnrollmentsBillingPort,
    EnrollmentsAttendancePort,
    EnrollmentsJobsPort,
    EnrollmentsTransportPort {}
