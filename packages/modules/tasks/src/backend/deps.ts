import type { TasksPorts } from "./ports.js";

let ports: TasksPorts | null = null;

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureTasksPorts(next: TasksPorts): void {
  ports = next;
}

function requirePorts(): TasksPorts {
  if (!ports) throw new Error("Tasks ports are not configured (call configureTasksPorts)");
  return ports;
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
export const messagingUseCases: any = new Proxy(
  {},
  {
    get:
      (_t, prop) =>
      (...args: any[]) =>
        (requirePorts().messagingUseCases as any)[prop](...args),
  },
);
export const usersUseCases: any = new Proxy(
  {},
  {
    get:
      (_t, prop) =>
      (...args: any[]) =>
        (requirePorts().usersUseCases as any)[prop](...args),
  },
);

export function lockFacultyHierarchy(...args: any[]): any {
  return requirePorts().lockFacultyHierarchy(...args);
}
export function tenantUserHasPermission(...args: any[]): Promise<boolean> {
  return requirePorts().tenantUserHasPermission(...args);
}
export function dispatchMessagingCampaignDirect(...args: any[]): Promise<any> {
  return requirePorts().dispatchMessagingCampaignDirect(...args);
}
export function getTenantUsersSettings(...args: any[]): Promise<any> {
  return requirePorts().getTenantUsersSettings(...args);
}
export function getTenantRoleCatalog(...args: any[]): Promise<any> {
  return requirePorts().getTenantRoleCatalog(...args);
}
export function findFacultyByIds(...args: any[]): Promise<any> {
  return requirePorts().findFacultyByIds(...args);
}
export function loadContactsSummaryByIdsForTenant(...args: any[]): Promise<any> {
  return requirePorts().loadContactsSummaryByIdsForTenant(...args);
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
