/**
 * App-bound ports for the sessions module.
 *
 * Enrollment transitions/rollover, attendance calendar + countable SQL, workspace
 * timezone, auth-artifact cleanup and CSV export enqueue stay in the app; the
 * composition root binds them in `apps/api/src/modules/sessions/adapters.ts`.
 */
export interface SessionsEnrollmentsPort {
  SYSTEM_ACTOR: any;
  completeLiveEnrollments(...args: any[]): Promise<any>;
  endLiveEnrollments(...args: any[]): Promise<any>;
  bulkCloseRolloverSourceEnrollments(...args: any[]): Promise<any>;
  carryRolloverEnrollments(...args: any[]): Promise<any>;
  listRolloverCandidates(...args: any[]): Promise<any>;
  bulkEnrollStudentsIntoClass(...args: any[]): Promise<any>;
  streamAcademicCalendarCsv(...args: any[]): Iterable<any>;
  streamAcademicCalendarIcs(...args: any[]): Iterable<any>;
}

export interface SessionsAttendancePort {
  copySessionCalendarEvents(...args: any[]): Promise<any>;
  loadCountableAttendanceSql(...args: any[]): any;
  isPresentOrLateSql(...args: any[]): any;
  loadWorkspaceWeekdays(...args: any[]): Promise<any>;
}

export interface SessionsStudentsPort {
  syncEnrolledSessionsTx(...args: any[]): Promise<any>;
  getPreparedSessionById(...args: any[]): any;
}

export interface SessionsFacultyPort {
  findFacultyByIds(...args: any[]): Promise<any>;
}

export interface SessionsWorkspacePort {
  findWorkspaceTimezone(...args: any[]): Promise<any>;
  getWorkspaceTimezone(...args: any[]): Promise<any>;
}

export interface SessionsAuthPort {
  deleteRefreshTokensForUser(...args: any[]): Promise<any>;
}

export interface SessionsPlatformPort {
  getPlatformSettings(...args: any[]): any;
  getPlatformIdleSessionMinutes(): number;
  platformSettingsService: any;
}

export interface SessionsJobsPort {
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

export interface SessionsPorts
  extends
    SessionsEnrollmentsPort,
    SessionsAttendancePort,
    SessionsFacultyPort,
    SessionsStudentsPort,
    SessionsWorkspacePort,
    SessionsAuthPort,
    SessionsJobsPort,
    SessionsPlatformPort {}
