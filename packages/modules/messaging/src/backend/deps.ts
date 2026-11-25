import type { MessagingPorts } from "./ports.js";

let ports: MessagingPorts | null = null;

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureMessagingPorts(next: MessagingPorts): void {
  ports = next;
}

function requirePorts(): MessagingPorts {
  if (!ports) throw new Error("Messaging ports are not configured (call configureMessagingPorts)");
  return ports;
}

export function loadContactsPageForTenant(...args: any[]) {
  return requirePorts().loadContactsPageForTenant(...args);
}
export function loadContactsSummaryByIdsForTenant(...args: any[]) {
  return requirePorts().loadContactsSummaryByIdsForTenant(...args);
}
export function loadContactFieldConfig(...args: any[]) {
  return requirePorts().loadContactFieldConfig(...args);
}
export function sendTenantSms(...args: any[]) {
  return requirePorts().sendTenantSms(...args);
}
export function sendTenantWhatsApp(...args: any[]) {
  return requirePorts().sendTenantWhatsApp(...args);
}
export function sendTenantEmail(...args: any[]) {
  return requirePorts().sendTenantEmail(...args);
}
export function createStrictRateLimitGuard(scope: unknown): any {
  return requirePorts().createStrictRateLimitGuard(scope);
}
export function enqueueBackgroundJob(...args: any[]) {
  return requirePorts().enqueueBackgroundJob(...args);
}
export function getUserBackgroundJob(...args: any[]) {
  return requirePorts().getUserBackgroundJob(...args);
}
export function getUserBackgroundJobPayload(...args: any[]) {
  return requirePorts().getUserBackgroundJobPayload(...args);
}
export function authArtifactUserScopeKey(...args: any[]) {
  return requirePorts().authArtifactUserScopeKey(...args);
}
export function authArtifactWorkspaceScopeKey(...args: any[]) {
  return requirePorts().authArtifactWorkspaceScopeKey(...args);
}
export function deleteAuthArtifact<T>(...args: any[]): Promise<any & T> {
  return requirePorts().deleteAuthArtifact(...args);
}
export function findAuthArtifactByLookupKey<T>(...args: any[]): Promise<any & T> {
  return requirePorts().findAuthArtifactByLookupKey(...args);
}
export function tryClaimAuthArtifactByLookupKey<T>(...args: any[]): Promise<any & T> {
  return requirePorts().tryClaimAuthArtifactByLookupKey(...args);
}
export function updateAuthArtifactPayload<T>(...args: any[]): Promise<any & T> {
  return requirePorts().updateAuthArtifactPayload(...args);
}
export function registerModuleCsvExportJobRunner(options: Record<string, unknown>): void {
  requirePorts().registerModuleCsvExportJobRunner(options);
}
