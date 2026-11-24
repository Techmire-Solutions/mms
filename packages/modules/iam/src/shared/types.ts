import type { PlatformAdminPermissions } from "@mms/contracts";

export type {
  CreateWorkspaceUserInput,
  EditWorkspaceUserInput,
  InviteWorkspaceUserInput,
  PlatformAdminPermissionKey,
  PlatformUserProfile,
  UserStatus,
  WorkspaceRole,
  WorkspaceUser,
} from "@mms/contracts";

/** Minimal member shape the IAM policy layer needs; avoids leaking DB rows into the module. */
export interface IamMemberSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive" | "suspended";
  contactId?: string | number;
  deletedAt?: string | null;
}

/** Platform actor shape used by the IAM service; subset of `PlatformUser`. */
export interface IamPlatformActor {
  id: string;
  role: "super_user" | "admin";
  permissions: PlatformAdminPermissions;
  name: string;
  email: string;
}

export interface IamTenantContext {
  tenantId: string;
  actor: { id: string | number; role?: string; name?: string };
  ip?: string;
  origin?: string;
  requestId: string;
}

/** Search result row for the platform IAM console. */
export interface PlatformIamUserResult {
  tenant: string;
  user: IamMemberSummary;
}

export interface PlatformIamOrgResult {
  subdomain: string;
  madrasaName: string;
  enabled: boolean;
}

export interface PlatformIamSearchPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
