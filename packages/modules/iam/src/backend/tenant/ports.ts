import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  ActivityLog,
  Contact,
  DesignationRoleSource,
  FacultyEmployDesignationWriteRow,
  GlobalSettings,
  Workspace,
  WorkspaceRole,
  WorkspaceUser,
} from "@mms/contracts";
import type { tenantUsers } from "@mms/db/schema";

export type PersistedUser = Partial<WorkspaceUser> & {
  id: string;
  contactId?: string;
  name?: string;
  email?: string;
  loginEmail?: string;
  phone?: string;
  role?: string;
  roleSource?: "faculty_designations" | "manual";
  status?: WorkspaceUser["status"];
  twoFactorEnabled?: boolean;
  lastLogin?: string;
  createdDate?: string;
  createdAt?: string;
  failedLoginAttempts?: number;
  activeSessions?: number;
  avatarInitials?: string;
  passwordHash?: string;
  mustChangePassword?: boolean;
  emailVerifiedAt?: string;
  workspaceSubdomain?: string;
} & Record<string, unknown>;

export interface IamBackgroundJobRecord {
  id: string;
  moduleId: string;
  kind: string;
  status: string;
  label: string;
  createdAt: string;
  [key: string]: unknown;
}

export type IamFacultyDesignationRecord = DesignationRoleSource & {
  id: string;
  status?: string;
};

export interface IamFacultyRecordSnapshot {
  employDesignations?: FacultyEmployDesignationWriteRow[];
  designationId?: string | number | null;
  designationStartDate?: string | null;
  designationEndDate?: string | null;
  employDesignationStatus?: unknown;
  profileStatus?: unknown;
  employDesignationId?: string | null;
}

export interface IamFacultyRoleAssignment {
  kind: string;
  roleId?: string;
  composite?: WorkspaceRole;
}

export interface IamCsvExportEnqueueInput {
  tenant: string;
  userId: string;
  moduleId: string;
  label: string;
  query: Record<string, unknown>;
  columns?: Array<{ id: string; label: string }>;
  filename?: string;
  viewerRole?: string;
  allowDeleted?: boolean;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface IamWelcomeEmailInput {
  workspaceSubdomain: string;
  email: string;
  name: string;
  origin: string;
  phone?: string;
}

export interface IamPreparedTenantUserByIdStmt {
  execute(params: {
    subdomain: string;
    id: string;
  }): Promise<Array<typeof tenantUsers.$inferSelect>>;
}

export interface IamWorkspaceWithBranding {
  branding?: { email?: string | null } & Record<string, unknown>;
  [key: string]: unknown;
}

export type IamAsyncRouteGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export interface IamUsersContactsPort {
  loadContactsByIds(ids: string[]): Promise<Contact[]>;
}

export interface IamUsersFacultyPort {
  findFacultyByContactId(
    tenant: string,
    contactId: string,
  ): Promise<IamFacultyRecordSnapshot | null | undefined>;
  isFacultyDesignationRoleLocked(tenant: string, contactId?: string): Promise<boolean> | boolean;
  listFacultyDesignations(
    tenant: string,
    options?: { limit?: number | null },
  ): Promise<IamFacultyDesignationRecord[]>;
  resolveFacultyContactRoleAssignment(
    tenant: string,
    contactId: string,
  ): Promise<IamFacultyRoleAssignment | null | undefined>;
  upsertFacultyManagedWorkspaceRole(tenant: string, role: WorkspaceRole): Promise<unknown>;
}

export interface IamUsersLogsPort {
  findActivityLogById(tenant: string, id: string): Promise<ActivityLog | null>;
  findActivityLogsByIds(tenant: string, ids: string[]): Promise<ActivityLog[]>;
  listActivityLogsByWorkspace(tenant: string): Promise<ActivityLog[]>;
  saveActivityLog(tenant: string, record: ActivityLog): Promise<void>;
  bulkSaveActivityLogs(tenant: string, records: ActivityLog[]): Promise<void>;
  replaceActivityLogsForWorkspace(tenant: string, records: ActivityLog[]): Promise<void>;
}

export interface IamUsersJobsPort {
  enqueueCsvExportJob(input: IamCsvExportEnqueueInput): Promise<IamBackgroundJobRecord>;
  normalizeExportQuery(
    query: Record<string, unknown> | undefined,
    allowDeleted: boolean,
  ): Record<string, unknown>;
  enqueueBackgroundJob(
    tenant: string,
    userId: string,
    job: IamBackgroundJobRecord,
    payload?: Record<string, unknown>,
  ): Promise<IamBackgroundJobRecord>;
  getUserBackgroundJob(
    userId: string,
    jobId: string,
  ): Promise<IamBackgroundJobRecord | null | undefined>;
  getUserBackgroundJobPayload(
    userId: string,
    jobId: string,
  ): Promise<Record<string, unknown> | null | undefined>;
  retryFailedBackgroundJob(
    tenant: string,
    userId: string,
    existing: IamBackgroundJobRecord,
    payload?: Record<string, unknown>,
  ): Promise<IamBackgroundJobRecord>;
  hasBackgroundJobRunner(jobId: string): boolean;
  isBackgroundJobLimitError(error: unknown): boolean;
  isQueueUnavailableError(error: unknown): boolean;
  registerModuleCsvExportJobRunner(options: Record<string, unknown>): void;
}

export interface IamUsersRbacPort {
  invalidateTenantRbac(tenant: string): Promise<unknown>;
}

export interface IamUsersStudentsPort {
  getPreparedTenantUserById(tx: unknown): IamPreparedTenantUserByIdStmt | null | undefined;
}

export interface IamUsersWorkspacePort {
  findWorkspaceBySubdomain(subdomain: string): Promise<Workspace | null>;
  findWorkspaceById(id: string): Promise<Workspace | null>;
  getWorkspaceWithBranding(subdomain: string): Promise<IamWorkspaceWithBranding | null | undefined>;
  normalizeSubdomainInput(subdomain: string): string;
}

export interface IamUsersAuthPort {
  getHydratedUsers(options?: { includeDeleted?: boolean }): Promise<PersistedUser[]>;
  saveUsers(users: PersistedUser[]): Promise<unknown>;
  getRawUsers(): Promise<PersistedUser[]>;
  sendTenantWelcomeEmail(input: IamWelcomeEmailInput): Promise<{ sent: boolean; error?: string }>;
  mergeWorkspaceRolesForPrefsSave(
    incoming: WorkspaceRole[] | undefined,
    existing: WorkspaceRole[] | undefined,
  ): Promise<WorkspaceRole[]>;
  assertPasswordMeetsPolicy(password: string): Promise<void>;
  deleteRefreshTokensForUser(userId: string): Promise<unknown>;
  verifyPassword(password: string, storedHash: string): Promise<boolean>;
  changeTenantUserPassword(...args: never[]): Promise<unknown>;
  validateCredentials(...args: never[]): Promise<unknown>;
  userUiState: Record<string, unknown>;
  getUserUiState(...args: never[]): Promise<unknown>;
  patchUserUiState(...args: never[]): Promise<unknown>;
}

export interface IamUsersSettingsPort {
  getGlobalSettings(subdomain?: string): Promise<GlobalSettings>;
}

export interface IamUsersPasswordPort {
  hashPassword(password: string): Promise<string>;
}

export interface IamUsersRateLimitPort {
  createStrictRateLimitGuard(
    scope: FastifyInstance,
    config?: Record<string, unknown>,
  ): IamAsyncRouteGuard;
}

export interface IamUsersPorts
  extends
    IamUsersContactsPort,
    IamUsersFacultyPort,
    IamUsersLogsPort,
    IamUsersJobsPort,
    IamUsersRateLimitPort,
    IamUsersRbacPort,
    IamUsersStudentsPort,
    IamUsersPasswordPort,
    IamUsersWorkspacePort,
    IamUsersSettingsPort,
    IamUsersAuthPort {}
