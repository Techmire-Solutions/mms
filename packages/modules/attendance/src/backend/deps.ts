import type { AttendancePorts } from "./ports.js";

let ports: AttendancePorts | null = null;

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureAttendancePorts(next: AttendancePorts): void {
  ports = next;
}

function requirePorts(): AttendancePorts {
  if (!ports)
    throw new Error("Attendance ports are not configured (call configureAttendancePorts)");
  return ports;
}

export const sessionsAcademicRepository: any = new Proxy(
  {},
  {
    get: (_t, prop) => (requirePorts().sessionsAcademicRepository as any)[prop],
  },
);
export const sessionsUseCases: any = new Proxy(
  {},
  {
    get:
      (_t, prop) =>
      (...args: any[]) =>
        (requirePorts().sessionsUseCases as any)[prop](...args),
  },
);
export const notificationsUseCases: any = new Proxy(
  {},
  {
    get:
      (_t, prop) =>
      (...args: any[]) =>
        (requirePorts().notificationsUseCases as any)[prop](...args),
  },
);
export const xlsxExportSerializer: any = new Proxy(
  {},
  {
    get:
      (_t, prop) =>
      (...args: any[]) =>
        (requirePorts().xlsxExportSerializer as any)[prop](...args),
  },
);
export function buildXlsxBuffer(...args: any[]): any {
  return requirePorts().buildXlsxBuffer(...args);
}
export function resolveTenantExportKey(...args: any[]): any {
  return requirePorts().resolveTenantExportKey(...args);
}
export function uploadBufferToStorage(...args: any[]): Promise<any> {
  return requirePorts().uploadBufferToStorage(...args);
}
export function uploadStreamToStorage(...args: any[]): Promise<any> {
  return requirePorts().uploadStreamToStorage(...args);
}
export function saveExportArtifact(...args: any[]): Promise<any> {
  return requirePorts().saveExportArtifact(...args);
}
export function saveStreamedExportArtifact(...args: any[]): Promise<any> {
  return requirePorts().saveStreamedExportArtifact(...args);
}
export function findStudentById(...args: any[]): Promise<any> {
  return requirePorts().findStudentById(...args);
}
export function findStudentsByIds(...args: any[]): Promise<any> {
  return requirePorts().findStudentsByIds(...args);
}
export function findClassById(...args: any[]): Promise<any> {
  return requirePorts().findClassById(...args);
}
export function findClassesByIds(...args: any[]): Promise<any> {
  return requirePorts().findClassesByIds(...args);
}
export function getWorkspaceTimezone(...args: any[]): Promise<any> {
  return requirePorts().getWorkspaceTimezone(...args);
}
export const getStorageConfig: any = (...args: any[]) => requirePorts().getStorageConfig(...args);

export function assertTeacherClassScope(...args: any[]): Promise<any> {
  return requirePorts().assertTeacherClassScope(...args);
}
export function assertTeacherSectionScope(...args: any[]): Promise<any> {
  return requirePorts().assertTeacherSectionScope(...args);
}
export function listEnrollmentPlacements(...args: any[]): Promise<any> {
  return requirePorts().listEnrollmentPlacements(...args);
}
export function listEnrollmentPlacementsAsOf(...args: any[]): Promise<any> {
  return requirePorts().listEnrollmentPlacementsAsOf(...args);
}
export function listEnrollmentPlacementsForDates(...args: any[]): Promise<any> {
  return requirePorts().listEnrollmentPlacementsForDates(...args);
}
export function findStudentsByNames(...args: any[]): Promise<any> {
  return requirePorts().findStudentsByNames(...args);
}
export function listEnrollmentPlacementsTx(...args: any[]): Promise<any> {
  return requirePorts().listEnrollmentPlacementsTx(...args);
}
export function loadSessionWorkingDaysTx(...args: any[]): Promise<any> {
  return requirePorts().loadSessionWorkingDaysTx(...args);
}
export function saveSession(...args: any[]): Promise<any> {
  return requirePorts().saveSession(...args);
}
export function findSessionById(...args: any[]): Promise<any> {
  return requirePorts().findSessionById(...args);
}
export function findWorkspaceTimezone(...args: any[]): Promise<any> {
  return requirePorts().findWorkspaceTimezone(...args);
}
export function enqueueCsvExportJob(...args: any[]): Promise<any> {
  return requirePorts().enqueueCsvExportJob(...args);
}
export function enqueueBackgroundJob(...args: any[]): Promise<any> {
  return requirePorts().enqueueBackgroundJob(...args);
}
export function getUserBackgroundJob(...args: any[]): Promise<any> {
  return requirePorts().getUserBackgroundJob(...args);
}
export function getUserBackgroundJobPayload(...args: any[]): Promise<any> {
  return requirePorts().getUserBackgroundJobPayload(...args);
}
export function retryFailedBackgroundJob(...args: any[]): Promise<any> {
  return requirePorts().retryFailedBackgroundJob(...args);
}
export function normalizeExportQuery(...args: any[]): any {
  return requirePorts().normalizeExportQuery(...args);
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
export function registerModuleCsvExportJobRunner(options: Record<string, unknown>): void {
  requirePorts().registerModuleCsvExportJobRunner(options);
}
