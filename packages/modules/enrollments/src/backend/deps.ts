import type { EnrollmentsPorts } from "./ports.js";

let ports: EnrollmentsPorts | null = null;

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureEnrollmentsPorts(next: EnrollmentsPorts): void {
  ports = next;
}

function requirePorts(): EnrollmentsPorts {
  if (!ports)
    throw new Error("Enrollments ports are not configured (call configureEnrollmentsPorts)");
  return ports;
}

export function findRegistrationLinkBySlugTx(...args: any[]): Promise<any> {
  return requirePorts().findRegistrationLinkBySlugTx(...args);
}
export function findSessionById(...args: any[]): Promise<any> {
  return requirePorts().findSessionById(...args);
}
export function findSessionsByIds(...args: any[]): Promise<any> {
  return requirePorts().findSessionsByIds(...args);
}
export function getSessionModulePreferencesByWorkspace(...args: any[]): Promise<any> {
  return requirePorts().getSessionModulePreferencesByWorkspace(...args);
}
export function listActiveRegistrationLinksTx(...args: any[]): Promise<any> {
  return requirePorts().listActiveRegistrationLinksTx(...args);
}
export function lockRegistrationLinkTx(...args: any[]): Promise<any> {
  return requirePorts().lockRegistrationLinkTx(...args);
}
export function syncEnrolledSessionsTx(...args: any[]): Promise<any> {
  return requirePorts().syncEnrolledSessionsTx(...args);
}
export function findStudentById(...args: any[]): Promise<any> {
  return requirePorts().findStudentById(...args);
}
export function findStudentsByIds(...args: any[]): Promise<any> {
  return requirePorts().findStudentsByIds(...args);
}
export function createStudent(...args: any[]): Promise<any> {
  return requirePorts().createStudent(...args);
}
export function upsertContact(...args: any[]): Promise<any> {
  return requirePorts().upsertContact(...args);
}
export function settleEnrollmentWithdrawal(...args: any[]): Promise<any> {
  return requirePorts().settleEnrollmentWithdrawal(...args);
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
export function sendTenantSms(...args: any[]): Promise<any> {
  return requirePorts().sendTenantSms(...args);
}
export function sendTenantWhatsApp(...args: any[]): Promise<any> {
  return requirePorts().sendTenantWhatsApp(...args);
}
export type LiveSeatCount = any;

export function enrollmentHoldsSeatWhere(...args: any[]): any {
  return requirePorts().enrollmentHoldsSeatWhere(...args);
}
export function closePlacementTx(...args: any[]): any {
  return requirePorts().closePlacementTx(...args);
}
export function insertTypedTimelineEventTx(...args: any[]): any {
  return requirePorts().insertTypedTimelineEventTx(...args);
}
export function movePlacementTx(...args: any[]): any {
  return requirePorts().movePlacementTx(...args);
}
export function lockAndAssertTargetSectionTx(...args: any[]): any {
  return requirePorts().lockAndAssertTargetSectionTx(...args);
}
export function countLiveSeatsByClassTx(...args: any[]): any {
  return requirePorts().countLiveSeatsByClassTx(...args);
}
export function lockRolloverCarryTx(...args: any[]): any {
  return requirePorts().lockRolloverCarryTx(...args);
}
export function recordEnrollmentSuspension(...args: any[]): any {
  return requirePorts().recordEnrollmentSuspension(...args);
}
export function appendClientTimelineTx(...args: any[]): any {
  return requirePorts().appendClientTimelineTx(...args);
}
export function syncPlacementsTx(...args: any[]): any {
  return requirePorts().syncPlacementsTx(...args);
}
export function enrollmentHoldsSeatSql(...args: any[]): any {
  return requirePorts().enrollmentHoldsSeatSql(...args);
}
export type LockedSeatSection = any;

export function countLiveSeatsBySectionTx(...args: any[]): Promise<any> {
  return requirePorts().countLiveSeatsBySectionTx(...args);
}
export function loadEnrollmentSeatHoldersTx(...args: any[]): Promise<any> {
  return requirePorts().loadEnrollmentSeatHoldersTx(...args);
}
export function lockSectionsForSeatsTx(...args: any[]): Promise<any> {
  return requirePorts().lockSectionsForSeatsTx(...args);
}
export function recordApprovedLeave(...args: any[]): Promise<any> {
  return requirePorts().recordApprovedLeave(...args);
}

export function maybeGenerateInvoiceForEnrollment(...args: any[]): Promise<any> {
  return requirePorts().maybeGenerateInvoiceForEnrollment(...args);
}
export function getWorkspaceBySubdomain(...args: any[]): Promise<any> {
  return requirePorts().getWorkspaceBySubdomain(...args);
}
export function cascadeSoftDeleteEnrollmentsForStudents(...args: any[]): Promise<any> {
  return requirePorts().cascadeSoftDeleteEnrollmentsForStudents(...args);
}
export function restoreCascadedEnrollmentsForStudents(...args: any[]): Promise<any> {
  return requirePorts().restoreCascadedEnrollmentsForStudents(...args);
}
export function restoreSessionWithCascade(...args: any[]): Promise<any> {
  return requirePorts().restoreSessionWithCascade(...args);
}
export function saveSession(...args: any[]): Promise<any> {
  return requirePorts().saveSession(...args);
}
export function transitionSession(...args: any[]): Promise<any> {
  return requirePorts().transitionSession(...args);
}
export function bulkSaveInvoices(...args: any[]): Promise<any> {
  return requirePorts().bulkSaveInvoices(...args);
}
export function bulkSoftDeleteStudentsSql(...args: any[]): Promise<any> {
  return requirePorts().bulkSoftDeleteStudentsSql(...args);
}
export const registrationLinkUseCases: any = new Proxy(
  {},
  {
    get:
      (_t, prop) =>
      (...args: any[]) =>
        (requirePorts().registrationLinkUseCases as any)[prop](...args),
  },
);

export function softDeleteSessionWithCascade(...args: any[]): Promise<any> {
  return requirePorts().softDeleteSessionWithCascade(...args);
}

export const notificationsUseCases: any = new Proxy(
  {},
  {
    get:
      (_t, prop) =>
      (...args: any[]) =>
        (requirePorts().notificationsUseCases as any)[prop](...args),
  },
);
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
export function fetchPublicBrandingForSubdomain(subdomain: string): Promise<any> {
  const fn = requirePorts().fetchPublicBrandingForSubdomain;
  return fn ? fn(subdomain) : Promise.resolve({ madrasaName: "", logoUrl: null });
}
export function registerModuleCsvExportJobRunner(options: Record<string, unknown>): void {
  requirePorts().registerModuleCsvExportJobRunner(options);
}
