import type { StudentPorts } from "./ports.js";

export type BulkEnrollInput = any;
export type OperationActor = any;

const PORTS_KEY = Symbol.for("@mms/mod-students/ports");
type GlobalWithPorts = typeof globalThis & { [PORTS_KEY]?: StudentPorts | null };

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureStudentPorts(next: StudentPorts): void {
  (globalThis as GlobalWithPorts)[PORTS_KEY] = next;
}

function requirePorts(): StudentPorts {
  const ports = (globalThis as GlobalWithPorts)[PORTS_KEY];
  if (!ports) throw new Error("Student ports are not configured (call configureStudentPorts)");
  return ports;
}

export function upsertContact(...args: any[]): Promise<any> {
  return requirePorts().upsertContact(...args);
}
export function findContactsMatchingUniqueValues(...args: any[]): Promise<any> {
  return requirePorts().findContactsMatchingUniqueValues(...args);
}
export function reconcileContactSystemTags(...args: any[]): Promise<any> {
  return requirePorts().reconcileContactSystemTags(...args);
}
export function loadContactsByIdsForTenant(...args: any[]): Promise<any> {
  return requirePorts().loadContactsByIdsForTenant(...args);
}
export function loadContactsSummaryByIdsForTenant(...args: any[]): Promise<any> {
  return requirePorts().loadContactsSummaryByIdsForTenant(...args);
}
export function withdrawEnrollmentsForStudentStatus(...args: any[]): Promise<any> {
  return requirePorts().withdrawEnrollmentsForStudentStatus(...args);
}
export function bulkEnrollStudentsIntoClass(...args: any[]): Promise<any> {
  return requirePorts().bulkEnrollStudentsIntoClass(...args);
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
export function getModuleAccessDenial(...args: any[]): Promise<any> {
  return requirePorts().getModuleAccessDenial(...args);
}
export function registerModuleCsvExportJobRunner(options: Record<string, unknown>): void {
  requirePorts().registerModuleCsvExportJobRunner(options);
}
