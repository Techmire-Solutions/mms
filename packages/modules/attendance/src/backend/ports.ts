/**
 * App-bound ports for the attendance module.
 *
 * Sessions/enrollments/notifications/hasanat modules, workspace timezone, xlsx
 * serialization, storage config and job plumbing stay in the app; the composition
 * root binds them in `apps/api/src/modules/attendance/adapters.ts`.
 */
export interface AttendanceSessionsPort {
  sessionsAcademicRepository: any;
  saveSession(...args: any[]): Promise<any>;
  findSessionById(...args: any[]): Promise<any>;
  sessionsUseCases: any;
  assertTeacherClassScope(...args: any[]): Promise<any>;
  assertTeacherSectionScope(...args: any[]): Promise<any>;
}

export interface AttendanceEnrollmentsPort {
  listEnrollmentPlacements(...args: any[]): Promise<any>;
  listEnrollmentPlacementsAsOf(...args: any[]): Promise<any>;
  listEnrollmentPlacementsForDates(...args: any[]): Promise<any>;
  listEnrollmentPlacementsTx(...args: any[]): Promise<any>;
  loadSessionWorkingDaysTx(...args: any[]): Promise<any>;
}

export interface AttendanceNotificationsPort {
  notificationsUseCases: any;
}

export interface AttendanceReferencePort {
  findStudentById(...args: any[]): Promise<any>;
  findStudentsByIds(...args: any[]): Promise<any>;
  findClassById(...args: any[]): Promise<any>;
  findClassesByIds(...args: any[]): Promise<any>;
  getWorkspaceTimezone(...args: any[]): Promise<any>;
}

export interface AttendanceHasanatPort {
  findStudentsByNames(...args: any[]): Promise<any>;
}

export interface AttendanceJobsPort {
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

export interface AttendanceAppPort {
  findWorkspaceTimezone(...args: any[]): Promise<any>;
  getStorageConfig(...args: any[]): any;
  xlsxExportSerializer: any;
  buildXlsxBuffer(...args: any[]): any;
  resolveTenantExportKey(...args: any[]): any;
  uploadBufferToStorage(...args: any[]): Promise<any>;
  uploadStreamToStorage(...args: any[]): Promise<any>;
  saveExportArtifact(...args: any[]): Promise<any>;
  saveStreamedExportArtifact(...args: any[]): Promise<any>;
}

export interface AttendancePorts
  extends
    AttendanceSessionsPort,
    AttendanceEnrollmentsPort,
    AttendanceNotificationsPort,
    AttendanceHasanatPort,
    AttendanceReferencePort,
    AttendanceJobsPort,
    AttendanceAppPort {}
