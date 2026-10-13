import type { AppTranslationKey } from "../i18n/appTranslations.js";

/** Workspace account status (UI + local store; backend enforcement is future work). */
export type UserStatus = "active" | "inactive" | "suspended";

export const USER_STATUS_VALUES = [
  "active",
  "inactive",
  "suspended",
] as const satisfies readonly UserStatus[];

/** CRUD actions granted per module in the roles matrix. */
export type PermissionAction = "create" | "read" | "update" | "delete";

export const PERMISSION_ACTIONS: readonly PermissionAction[] = [
  "create",
  "read",
  "update",
  "delete",
] as const;

/** Map of module id → permitted actions. */
export type PermissionMap = Record<string, PermissionAction[]>;

export type UserBadgeVariant = "primary" | "muted" | "warning" | "destructive" | "success";

/** RBAC module row in the permissions grid. */
export interface RbacModuleDef {
  id: string;
  labelKey: AppTranslationKey;
}

/** System or custom role definition. */
export interface WorkspaceRole {
  id: string;
  labelKey: AppTranslationKey;
  descriptionKey: AppTranslationKey;
  /** Overrides `labelKey` for user-created roles. */
  customLabel?: string;
  /** Overrides `descriptionKey` for user-created roles. */
  customDescription?: string;
  isSystem: boolean;
  badgeVariant: UserBadgeVariant;
  permissions: PermissionMap;
  /** Server-owned role derived from faculty employ-designation assignable roles. */
  managedBy?: "faculty_designations";
  /** Sorted unique catalog role ids whose permissions were unioned into this role. */
  sourceRoleIds?: string[];
}

/** Local workspace user record (display layer; auth JWT uses singular `role`). */
export interface WorkspaceUser {
  id: string;
  contactId?: string | number;
  name: string;
  email: string;
  /** Auth sign-in identifier when user has credentials — may differ from contact email. */
  loginEmail?: string;
  /** True when the account must change an admin-issued temporary password. */
  mustChangePassword?: boolean;
  /** Write-only temporary password accepted by users bulk save; never returned by list APIs. */
  temporaryPassword?: string;
  phone: string;
  role: string;
  /**
   * How `role` is governed. `faculty_designations` means admins cannot change it
   * manually — it is synced from active employ-designation assignable roles.
   */
  roleSource?: "faculty_designations" | "manual";
  status: UserStatus;
  twoFactorEnabled: boolean;
  lastLogin: string;
  createdDate: string;
  failedLoginAttempts: number;
  activeSessions: number;
  avatarInitials: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
  restoredAt?: string | null;
  restoredBy?: string | null;
  deletedWithCascade?: boolean | null;
  emailVerifiedAt?: string | null;
  [key: string]: unknown;
}

export type SystemUser = WorkspaceUser;

export function isUserDeleted(user: { deletedAt?: string | null }): boolean {
  return Boolean(user.deletedAt);
}

export function filterActiveUsers<T extends { deletedAt?: string | null }>(users: T[]): T[] {
  return users.filter((u) => !isUserDeleted(u));
}

export const DEFAULT_WORKSPACE_USERS: WorkspaceUser[] = [];

/** Types of actions recorded in the activity log. */
import { z } from "zod";

export const ACTIVITY_ACTION_VALUES = [
  "login",
  "login_failed",
  "create",
  "update",
  "delete",
  "role_change",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTION_VALUES)[number];

export const activityLogSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    userName: z.string().optional(),
    action: z.enum(ACTIVITY_ACTION_VALUES),
    module: z.string(),
    detail: z.string(),
    ts: z.string(),
    ip: z.string(),
  })
  .strict();

export const activityLogInsertSchema = z
  .object({
    id: z.string().optional(),
    userId: z.string(),
    userName: z.string().optional(),
    action: z.enum(ACTIVITY_ACTION_VALUES),
    module: z.string(),
    detail: z.string().default(""),
    ts: z.string(),
    ip: z.string().default(""),
  })
  .strict();

/** A single activity log entry. */
export type ActivityLog = z.infer<typeof activityLogSchema>;
export type ActivityLogInsert = z.infer<typeof activityLogInsertSchema>;

export const DEFAULT_USER_ACTIVITY_LOGS: ActivityLog[] = [];
