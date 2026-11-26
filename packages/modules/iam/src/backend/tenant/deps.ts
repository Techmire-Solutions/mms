/**
 * App-bound ports for the IAM tenant (users) subtree.
 *
 * Contacts reads, faculty directory/lock helpers, activity-log storage, strict rate
 * limiting and background-job plumbing stay in the app / other modules; the app
 * composition root binds them in `apps/api/src/modules/iam/userAdapters.ts`.
 */
import type { FastifyInstance } from "fastify";
import type { ActivityLog, Contact, WorkspaceRole } from "@mms/contracts";
import type {
  IamAsyncRouteGuard,
  IamBackgroundJobRecord,
  IamCsvExportEnqueueInput,
  IamFacultyDesignationRecord,
  IamFacultyRecordSnapshot,
  IamFacultyRoleAssignment,
  IamPreparedTenantUserByIdStmt,
  IamUsersPorts,
  IamWelcomeEmailInput,
  IamWorkspaceWithBranding,
  PersistedUser,
} from "./ports.js";

export type * from "./ports.js";

const PORTS_KEY = Symbol.for("@mms/mod-iam/users-ports");
type GlobalWithPorts = typeof globalThis & { [PORTS_KEY]?: IamUsersPorts | null };

/** Composition-root binding; called once from `apps/api` before routes load. */
export function configureIamUsersPorts(next: IamUsersPorts): void {
  (globalThis as GlobalWithPorts)[PORTS_KEY] = next;
}

function requirePorts(): IamUsersPorts {
  const ports = (globalThis as GlobalWithPorts)[PORTS_KEY];
  if (!ports) throw new Error("IAM users ports are not configured (call configureIamUsersPorts)");
  return ports;
}

export function loadContactsByIds(ids: string[]): Promise<Contact[]> {
  return requirePorts().loadContactsByIds(ids);
}
export function findFacultyByContactId(
  tenant: string,
  contactId: string,
): Promise<IamFacultyRecordSnapshot | null | undefined> {
  return requirePorts().findFacultyByContactId(tenant, contactId);
}
export function isFacultyDesignationRoleLocked(
  tenant: string,
  contactId?: string,
): Promise<boolean> | boolean {
  return requirePorts().isFacultyDesignationRoleLocked(tenant, contactId);
}
export function listFacultyDesignations(
  tenant: string,
  options?: { limit?: number | null },
): Promise<IamFacultyDesignationRecord[]> {
  return requirePorts().listFacultyDesignations(tenant, options);
}
export function resolveFacultyContactRoleAssignment(
  tenant: string,
  contactId: string,
): Promise<IamFacultyRoleAssignment | null | undefined> {
  return requirePorts().resolveFacultyContactRoleAssignment(tenant, contactId);
}
export function upsertFacultyManagedWorkspaceRole(
  tenant: string,
  role: WorkspaceRole,
): Promise<unknown> {
  return requirePorts().upsertFacultyManagedWorkspaceRole(tenant, role);
}
export function findActivityLogById(tenant: string, id: string): Promise<ActivityLog | null> {
  return requirePorts().findActivityLogById(tenant, id);
}
export function findActivityLogsByIds(tenant: string, ids: string[]): Promise<ActivityLog[]> {
  return requirePorts().findActivityLogsByIds(tenant, ids);
}
export function listActivityLogsByWorkspace(tenant: string): Promise<ActivityLog[]> {
  return requirePorts().listActivityLogsByWorkspace(tenant);
}
export function saveActivityLog(tenant: string, record: ActivityLog): Promise<void> {
  return requirePorts().saveActivityLog(tenant, record);
}
export function bulkSaveActivityLogs(tenant: string, records: ActivityLog[]): Promise<void> {
  return requirePorts().bulkSaveActivityLogs(tenant, records);
}
export function replaceActivityLogsForWorkspace(
  tenant: string,
  records: ActivityLog[],
): Promise<void> {
  return requirePorts().replaceActivityLogsForWorkspace(tenant, records);
}
export function enqueueCsvExportJob(
  input: IamCsvExportEnqueueInput,
): Promise<IamBackgroundJobRecord> {
  return requirePorts().enqueueCsvExportJob(input);
}
export function normalizeExportQuery(
  query: Record<string, unknown> | undefined,
  allowDeleted: boolean,
): Record<string, unknown> {
  return requirePorts().normalizeExportQuery(query, allowDeleted);
}
export function enqueueBackgroundJob(
  tenant: string,
  userId: string,
  job: IamBackgroundJobRecord,
  payload?: Record<string, unknown>,
): Promise<IamBackgroundJobRecord> {
  return requirePorts().enqueueBackgroundJob(tenant, userId, job, payload);
}
export function getUserBackgroundJob(
  userId: string,
  jobId: string,
): Promise<IamBackgroundJobRecord | null | undefined> {
  return requirePorts().getUserBackgroundJob(userId, jobId);
}
export function getUserBackgroundJobPayload(
  userId: string,
  jobId: string,
): Promise<Record<string, unknown> | null | undefined> {
  return requirePorts().getUserBackgroundJobPayload(userId, jobId);
}
export function retryFailedBackgroundJob(
  tenant: string,
  userId: string,
  existing: IamBackgroundJobRecord,
  payload?: Record<string, unknown>,
): Promise<IamBackgroundJobRecord> {
  return requirePorts().retryFailedBackgroundJob(tenant, userId, existing, payload);
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
export function invalidateTenantRbac(tenant: string): Promise<unknown> {
  return requirePorts().invalidateTenantRbac(tenant);
}
export function getPreparedTenantUserById(
  tx: unknown,
): IamPreparedTenantUserByIdStmt | null | undefined {
  return requirePorts().getPreparedTenantUserById(tx);
}
export function getWorkspaceWithBranding(
  subdomain: string,
): Promise<IamWorkspaceWithBranding | null | undefined> {
  return requirePorts().getWorkspaceWithBranding(subdomain);
}
export function normalizeSubdomainInput(subdomain: string): string {
  return requirePorts().normalizeSubdomainInput(subdomain);
}
export function getHydratedUsers(options?: { includeDeleted?: boolean }): Promise<PersistedUser[]> {
  return requirePorts().getHydratedUsers(options);
}
export function saveUsers(users: PersistedUser[]): Promise<unknown> {
  return requirePorts().saveUsers(users);
}
export function getRawUsers(): Promise<PersistedUser[]> {
  return requirePorts().getRawUsers();
}
export function sendTenantWelcomeEmail(
  input: IamWelcomeEmailInput,
): Promise<{ sent: boolean; error?: string }> {
  return requirePorts().sendTenantWelcomeEmail(input);
}
export function mergeWorkspaceRolesForPrefsSave(
  incoming: WorkspaceRole[] | undefined,
  existing: WorkspaceRole[] | undefined,
): Promise<WorkspaceRole[]> {
  return requirePorts().mergeWorkspaceRolesForPrefsSave(incoming, existing);
}
export function assertPasswordMeetsPolicy(password: string): Promise<void> {
  return requirePorts().assertPasswordMeetsPolicy(password);
}
export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return requirePorts().verifyPassword(password, storedHash);
}
export function deleteRefreshTokensForUser(userId: string): Promise<unknown> {
  return requirePorts().deleteRefreshTokensForUser(userId);
}
export function hashPassword(password: string): Promise<string> {
  return requirePorts().hashPassword(password);
}
export function createStrictRateLimitGuard(
  scope: FastifyInstance,
  config?: Record<string, unknown>,
): IamAsyncRouteGuard {
  return requirePorts().createStrictRateLimitGuard(scope, config);
}
