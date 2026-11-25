import type { FacultyPorts } from "./ports.js";

const PORTS_KEY = Symbol.for("@mms/mod-faculty/ports");
type GlobalWithPorts = typeof globalThis & { [PORTS_KEY]?: FacultyPorts | null };

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureFacultyPorts(next: FacultyPorts): void {
  (globalThis as GlobalWithPorts)[PORTS_KEY] = next;
}

function requirePorts(): FacultyPorts {
  const ports = (globalThis as GlobalWithPorts)[PORTS_KEY];
  if (!ports) throw new Error("Faculty ports are not configured (call configureFacultyPorts)");
  return ports;
}

export function reconcileFacultyContactsByFacultyIds(...args: any[]) {
  return requirePorts().reconcileFacultyContactsByFacultyIds(...args);
}
export function reconcileContactSystemTags(...args: any[]) {
  return requirePorts().reconcileContactSystemTags(...args);
}
export function reconcileDesignationContacts(...args: any[]) {
  return requirePorts().reconcileDesignationContacts(...args);
}
export function loadContactsSummaryByIdsForTenant(...args: any[]) {
  return requirePorts().loadContactsSummaryByIdsForTenant(...args);
}
export function findTenantUserRowByContactId(...args: any[]) {
  return requirePorts().findTenantUserRowByContactId(...args);
}
export function upsertTenantUserRow(...args: any[]) {
  return requirePorts().upsertTenantUserRow(...args);
}
export function listAllTenantUsersByWorkspace(...args: any[]) {
  return requirePorts().listAllTenantUsersByWorkspace(...args);
}
export function getTenantUsersSettings(...args: any[]) {
  return requirePorts().getTenantUsersSettings(...args);
}
export function resolveCurrentTenantRole(...args: any[]) {
  return requirePorts().resolveCurrentTenantRole(...args);
}
export function tenantUserHasPermission(...args: any[]) {
  return requirePorts().tenantUserHasPermission(...args);
}
export function getUserModulePreferencesByWorkspace(...args: any[]) {
  return requirePorts().getUserModulePreferencesByWorkspace(...args);
}
export function upsertUserModulePreferences(...args: any[]) {
  return requirePorts().upsertUserModulePreferences(...args);
}
export function invalidateTenantRbac(...args: any[]) {
  return requirePorts().invalidateTenantRbac(...args);
}
export function registerModuleCsvExportJobRunner(
  options: Parameters<FacultyPorts["registerModuleCsvExportJobRunner"]>[0],
): void {
  requirePorts().registerModuleCsvExportJobRunner(options);
}
