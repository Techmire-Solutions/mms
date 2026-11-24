import type {
  CreateWorkspaceUserInput,
  EditWorkspaceUserInput,
  InviteWorkspaceUserInput,
  PlatformUserProfile,
  WorkspaceRole,
  WorkspaceUser,
} from "@mms/contracts";
import type {
  IamMemberSummary,
  IamPlatformActor,
  IamTenantContext,
  PlatformIamOrgResult,
  PlatformIamUserResult,
} from "../shared/types.js";

export interface TenantMemberPage {
  users: WorkspaceUser[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface TenantIamPort {
  listMembers(ctx: IamTenantContext, query: Record<string, unknown>): Promise<TenantMemberPage>;
  inviteMember(
    ctx: IamTenantContext,
    input: InviteWorkspaceUserInput,
  ): Promise<{ user: WorkspaceUser; inviteEmailSent?: boolean; inviteEmailError?: string }>;
  createMember(
    ctx: IamTenantContext,
    input: CreateWorkspaceUserInput,
  ): Promise<{ user: WorkspaceUser; inviteEmailSent?: boolean; inviteEmailError?: string }>;
  updateMember(
    ctx: IamTenantContext,
    id: string,
    input: Partial<EditWorkspaceUserInput>,
  ): Promise<WorkspaceUser>;
  removeMember(ctx: IamTenantContext, id: string): Promise<boolean>;
  restoreMember(ctx: IamTenantContext, id: string): Promise<boolean>;
  resetMemberPassword(
    ctx: IamTenantContext,
    id: string,
    temporaryPassword: string,
  ): Promise<boolean>;
  loadMembers(ctx: IamTenantContext): Promise<IamMemberSummary[]>;
  listRoles(ctx: IamTenantContext): Promise<WorkspaceRole[]>;
}

export interface PlatformIamPort {
  verifyActorPassword(actorId: string, password: string): Promise<boolean>;
  listAdmins(): Promise<PlatformUserProfile[]>;
  searchUsers(query: string, limit: number, offset: number): Promise<PlatformIamUserResult[]>;
  countUsers(query: string): Promise<number>;
  searchOrganizations(
    query: string,
    limit: number,
    offset: number,
  ): Promise<PlatformIamOrgResult[]>;
  countOrganizations(query: string): Promise<number>;
  findTenantUser(tenant: string, userId: string): Promise<IamMemberSummary | null>;
  setTenantUserStatus(
    tenant: string,
    userId: string,
    status: "active" | "suspended",
    reason: string,
  ): Promise<IamMemberSummary>;
  insertPlatformActivity(input: {
    actor: IamPlatformActor;
    action: string;
    targetResource: string;
    targetId: string;
    metadataMessage: string;
    ip?: string;
  }): Promise<string>;
  issueImpersonationHandoff(input: {
    user: IamMemberSummary;
    tenant: string;
    platformActorId: string;
    reason: string;
  }): Promise<{ handoffUrl: string; expiresAt: string }>;
  revokeTenantUserSessions(tenant: string, userId: string): Promise<void>;
}

export interface IamAuditPort {
  recordTenantAudit(input: {
    tenant: string;
    actorId: string;
    action: string;
    targetId: string;
    impersonatedUserId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface IamPorts {
  tenant: TenantIamPort;
  platform: PlatformIamPort;
  audit: IamAuditPort;
}
