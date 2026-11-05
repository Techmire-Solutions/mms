/**
 * @file facultyLinkedUserRoleSync.ts
 * @description Sync linked user role from faculty designations (catalog or composite).
 */
import {
  buildFacultyManagedRoleId,
  DEFAULT_WORKSPACE_ROLES,
  isAdminRole,
  isFacultyManagedRoleId,
  isFacultyProfileStatus,
  isSuperAdminRole,
  resolveFacultyDesignationRoleAssignment,
  roleHasPermission,
  type WorkspaceRole,
  type FacultyEmployDesignationWriteRow,
  type FacultyMember,
  type FacultyProfileStatus,
} from "@mms/shared";
import { listFacultyDesignations } from "../../db/repositories/facultyDesignationRepository.js";
import {
  findTenantUserRowByContactId,
  upsertTenantUserRow,
} from "../../db/repositories/tenantUserRepository.js";
import { invalidateTenantRbac } from "../../services/rbacService.js";
import { getTenantUsersSettings } from "../../services/users/usersSettingsService.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { resolveCurrentTenantRole } from "../../lib/currentTenantRole.js";
import { getRequestUserId } from "../../lib/tenantContext.js";
import { logger } from "../../lib/logger.js";
import {
  removeFacultyManagedWorkspaceRole,
  upsertFacultyManagedWorkspaceRole,
} from "./facultyManagedRolesPrefs.js";

/**
 * Fields that decide the designation-derived linked role.
 *
 * Callers compare the stored record with the incoming one: an identical
 * fingerprint means the role cannot change, so the sync (1–3 reads plus a
 * possible RBAC invalidation) is skipped for ordinary edits.
 */
export function facultyRoleFingerprint(member: Record<string, unknown>): string {
  const pick = (key: string): unknown => member[key] ?? null;
  return JSON.stringify({
    contactId: pick("contactId"),
    designationId: pick("designationId"),
    employDesignationId: pick("employDesignationId"),
    designationStartDate: pick("designationStartDate"),
    designationEndDate: pick("designationEndDate"),
    employDesignationStatus: pick("employDesignationStatus"),
    profileStatus: pick("profileStatus"),
    employDesignations: pick("employDesignations"),
  });
}

/**
 * A designation change that would rewrite the linked account's RBAC role is a
 * user-management operation: `faculty.write` alone must never grant it.
 */
export class FacultyRoleSyncForbiddenError extends Error {
  readonly statusCode = 403;
  readonly type = "forbidden";

  constructor() {
    super("Changing the linked user's role requires user-management permission");
    this.name = "FacultyRoleSyncForbiddenError";
  }
}

async function resolveActorRole(tenant: string): Promise<string | null> {
  const actorId = getRequestUserId();
  if (!actorId) return null;
  return resolveCurrentTenantRole(tenant, actorId);
}

function actorMayAssignRoles(
  actorRole: string | null,
  roleCatalog: readonly WorkspaceRole[],
): boolean {
  if (!actorRole) return false;
  return (
    isAdminRole(actorRole) ||
    isSuperAdminRole(actorRole) ||
    roleHasPermission(actorRole, "users.manage", roleCatalog)
  );
}

function resolveTenureStatus(status: string | null | undefined): FacultyProfileStatus {
  if (isFacultyProfileStatus(status)) return status;
  return "active";
}

function tenureRowsFromFaculty(member: FacultyMember): FacultyEmployDesignationWriteRow[] {
  if (Array.isArray(member.employDesignations) && member.employDesignations.length > 0) {
    return member.employDesignations;
  }
  const designationId = member.designationId?.trim();
  if (!designationId) return [];
  return [
    {
      designationId,
      designationStartDate: member.designationStartDate ?? null,
      designationEndDate: member.designationEndDate ?? null,
      employDesignationStatus: resolveTenureStatus(
        member.employDesignationStatus ?? member.profileStatus,
      ),
      employDesignationId: member.employDesignationId ?? null,
    },
  ];
}

/**
 * After faculty employ-designations are saved:
 * - 0 assignable roles → no-op
 * - 1 → assign catalog role (drop unused managed composite for this contact)
 * - 2+ → upsert managed composite role and assign it
 * Skips Super Admin accounts.
 */
export async function syncFacultyLinkedUserRole(
  tenant: string,
  facultyMember: Pick<
    FacultyMember,
    | "contactId"
    | "employDesignations"
    | "designationId"
    | "designationStartDate"
    | "designationEndDate"
    | "employDesignationStatus"
    | "profileStatus"
    | "employDesignationId"
  >,
): Promise<{ updated: boolean; roleId?: string }> {
  const subdomain = tenant.trim().toLowerCase();
  const contactId = facultyMember.contactId != null ? String(facultyMember.contactId).trim() : "";
  if (!subdomain || !contactId) return { updated: false };

  const linked = await findTenantUserRowByContactId(subdomain, contactId);
  if (!linked) return { updated: false };
  if (isSuperAdminRole(linked.role)) return { updated: false };

  const designations = await listFacultyDesignations(subdomain);
  const settings = await getTenantUsersSettings();
  const roleCatalog = settings.workspaceRoles?.length
    ? settings.workspaceRoles
    : [...DEFAULT_WORKSPACE_ROLES];

  const assignment = resolveFacultyDesignationRoleAssignment(
    contactId,
    tenureRowsFromFaculty(facultyMember as FacultyMember),
    designations,
    roleCatalog,
  );
  if (assignment.kind === "none" || !assignment.roleId) return { updated: false };

  const nextRole = assignment.roleId;
  const roleSource = "faculty_designations" as const;
  if (linked.role === nextRole && linked.roleSource === roleSource) {
    return { updated: false, roleId: nextRole };
  }

  // Mutating the linked account's RBAC role is a user-management operation.
  // Authorize it before any managed-role/composite side effect so a rejected
  // sync leaves no orphaned composite behind.
  if (linked.role !== nextRole) {
    const actorRole = await resolveActorRole(subdomain);
    if (!actorRole) {
      logger.warn(
        { tenant: subdomain, contactId, nextRole },
        "Skipping faculty linked-role sync: no authenticated actor",
      );
      return { updated: false };
    }
    const actorIsAdmin = isAdminRole(actorRole) || isSuperAdminRole(actorRole);
    const linkedIsAdmin = isAdminRole(linked.role) || isSuperAdminRole(linked.role);
    if ((linkedIsAdmin && !actorIsAdmin) || !actorMayAssignRoles(actorRole, roleCatalog)) {
      logger.warn(
        { tenant: subdomain, contactId, actorRole, linkedRole: linked.role, nextRole },
        "Blocked faculty linked-role change",
      );
      throw new FacultyRoleSyncForbiddenError();
    }
  }

  const managedId = buildFacultyManagedRoleId(contactId);

  if (assignment.kind === "composite" && assignment.composite) {
    await upsertFacultyManagedWorkspaceRole(subdomain, assignment.composite);
  } else if (isFacultyManagedRoleId(linked.role) || linked.role === managedId) {
    await removeFacultyManagedWorkspaceRole(subdomain, managedId);
  }

  await upsertTenantUserRow(subdomain, {
    ...linked,
    role: nextRole,
    roleSource,
  });
  await invalidateTenantRbac(subdomain);
  await broadcastCollection("users");
  return { updated: true, roleId: nextRole };
}
