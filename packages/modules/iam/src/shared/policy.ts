import {
  canAccessRolesAndPermissions,
  canManageTargetUser,
  isAdminRole,
  isPlatformManagedRole,
  isSuperAdminRole,
  platformUserCan,
} from "@mms/contracts";
import type { IamMemberSummary, IamPlatformActor } from "./types.js";
import { IamError } from "./errors.js";
import { PLATFORM_ADMIN_PERMISSION, PLATFORM_SUPER_USER_ROLE } from "./roles.js";

/** Tenant member management gate (delegates to the contract SSOT). */
export function canManageMember(
  actorRole: string | undefined,
  targetRole: string | undefined,
): boolean {
  return canManageTargetUser(actorRole, targetRole);
}

export function assertCanManageMember(
  actorRole: string | undefined,
  targetRole: string | undefined,
): void {
  if (!canManageMember(actorRole, targetRole)) {
    throw new IamError("forbidden", "Insufficient permissions to manage this member");
  }
}

export function isActiveAdmin(member: IamMemberSummary): boolean {
  return (
    !member.deletedAt &&
    member.status === "active" &&
    (isAdminRole(member.role) || isSuperAdminRole(member.role))
  );
}

/**
 * Refuses the operation that would leave a workspace with no active admin.
 * Removing/demoting/suspending any of the last active admins is blocked.
 */
export function lastAdminViolation(
  members: readonly IamMemberSummary[],
  targetId: string,
  nextStatus: IamMemberSummary["status"] = "active",
): boolean {
  const target = members.find((member) => member.id === targetId);
  if (!target || !isActiveAdmin(target)) return false;
  if (nextStatus === "active") return false;
  const remaining = members.filter(
    (member) => member.id !== targetId && isActiveAdmin(member) && member.status === "active",
  );
  return remaining.length === 0;
}

export function assertLastAdminRetained(
  members: readonly IamMemberSummary[],
  targetId: string,
  nextStatus: IamMemberSummary["status"],
): void {
  if (lastAdminViolation(members, targetId, nextStatus)) {
    throw new IamError(
      "conflict",
      "Cannot remove or suspend the last active workspace administrator",
    );
  }
}

export function canSuspendTenantUser(
  actor: { id: string | number; role?: string },
  target: IamMemberSummary,
): boolean {
  if (target.id === String(actor.id)) return false;
  if (!target.deletedAt && isPlatformManagedRole(target.role)) return false;
  return canAccessRolesAndPermissions(actor.role);
}

export function assertPlatformIamAccess(
  actor: IamPlatformActor,
  options: { requireSuperUser?: boolean } = {},
): void {
  if (
    !platformUserCan(
      { role: actor.role, permissions: actor.permissions },
      PLATFORM_ADMIN_PERMISSION,
    )
  ) {
    throw new IamError(
      "forbidden",
      `Missing platform IAM permission: ${PLATFORM_ADMIN_PERMISSION}`,
    );
  }
  if (options.requireSuperUser && actor.role !== PLATFORM_SUPER_USER_ROLE) {
    throw new IamError("forbidden", "Super-user privilege required for this IAM operation");
  }
}

/** Shared guard for suspension and impersonation reasons (10–500 chars). */
export function assertPlatformActionReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 10 || trimmed.length > 500) {
    throw new IamError("bad_request", "Reason must be between 10 and 500 characters");
  }
  return trimmed;
}

/** @deprecated alias — use {@link assertPlatformActionReason}. */
export const assertImpersonationReason = assertPlatformActionReason;
