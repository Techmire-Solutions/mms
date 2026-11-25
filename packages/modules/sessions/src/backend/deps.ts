import type { SessionsPorts } from "./ports.js";

const PORTS_KEY = Symbol.for("@mms/mod-sessions/ports");
type GlobalWithPorts = typeof globalThis & { [PORTS_KEY]?: SessionsPorts | null };

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureSessionsPorts(next: SessionsPorts): void {
  (globalThis as GlobalWithPorts)[PORTS_KEY] = next;
}

function requirePorts(): SessionsPorts {
  const ports = (globalThis as GlobalWithPorts)[PORTS_KEY];
  if (!ports) throw new Error("Sessions ports are not configured (call configureSessionsPorts)");
  return ports;
}

export function completeLiveEnrollments(...args: any[]): Promise<any> {
  return requirePorts().completeLiveEnrollments(...args);
}
export function endLiveEnrollments(...args: any[]): Promise<any> {
  return requirePorts().endLiveEnrollments(...args);
}
export function bulkCloseRolloverSourceEnrollments(...args: any[]): Promise<any> {
  return requirePorts().bulkCloseRolloverSourceEnrollments(...args);
}
export function carryRolloverEnrollments(...args: any[]): Promise<any> {
  return requirePorts().carryRolloverEnrollments(...args);
}
export function listRolloverCandidates(...args: any[]): Promise<any> {
  return requirePorts().listRolloverCandidates(...args);
}
export function copySessionCalendarEvents(...args: any[]): Promise<any> {
  return requirePorts().copySessionCalendarEvents(...args);
}
export function findFacultyByIds(...args: any[]): Promise<any> {
  return requirePorts().findFacultyByIds(...args);
}
export function findWorkspaceTimezone(...args: any[]): Promise<any> {
  return requirePorts().findWorkspaceTimezone(...args);
}
export function deleteRefreshTokensForUser(...args: any[]): Promise<any> {
  return requirePorts().deleteRefreshTokensForUser(...args);
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
export function loadCountableAttendanceSql(...args: any[]): any {
  return requirePorts().loadCountableAttendanceSql(...args);
}
export function isPresentOrLateSql(...args: any[]): any {
  return requirePorts().isPresentOrLateSql(...args);
}
export function loadWorkspaceWeekdays(...args: any[]): Promise<any> {
  return requirePorts().loadWorkspaceWeekdays(...args);
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
export function syncEnrolledSessionsTx(...args: any[]): any {
  return requirePorts().syncEnrolledSessionsTx(...args);
}
export function getPreparedSessionById(...args: any[]): any {
  return requirePorts().getPreparedSessionById(...args);
}
export function getWorkspaceTimezone(...args: any[]): Promise<any> {
  return requirePorts().getWorkspaceTimezone(...args);
}
export const platformSettingsService: any = new Proxy(
  {},
  {
    get:
      (_t, prop) =>
      (...args: any[]) =>
        (requirePorts().platformSettingsService as any)[prop](...args),
  },
);
export function getPlatformSettings(...args: any[]): Promise<any> {
  return requirePorts().getPlatformSettings(...args);
}
export const SYSTEM_ACTOR: any = new Proxy(
  {},
  {
    get: (_t, prop) => (requirePorts().SYSTEM_ACTOR as any)?.[prop],
  },
);
export function getPlatformIdleSessionMinutes(): number {
  return requirePorts().getPlatformIdleSessionMinutes();
}
export function bulkEnrollStudentsIntoClass(...args: any[]): Promise<any> {
  return requirePorts().bulkEnrollStudentsIntoClass(...args);
}
export function* streamAcademicCalendarCsv(...args: any[]): Generator<any> {
  yield* requirePorts().streamAcademicCalendarCsv(...args);
}
export function* streamAcademicCalendarIcs(...args: any[]): Generator<any> {
  yield* requirePorts().streamAcademicCalendarIcs(...args);
}
export function registerModuleCsvExportJobRunner(options: Record<string, unknown>): void {
  requirePorts().registerModuleCsvExportJobRunner(options);
}
