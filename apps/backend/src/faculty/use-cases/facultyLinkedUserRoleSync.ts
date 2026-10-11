/**
 * @file facultyLinkedUserRoleSync.ts
 * @description Sync linked user role from faculty designations (catalog or composite).
 */
import {
  buildFacultyManagedRoleId,
  DEFAULT_WORKSPACE_ROLES,
  isFacultyManagedRoleId,
  isFacultyProfileStatus,
  isSuperAdminRole,
  resolveFacultyDesignationRoleAssignment,
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
import {
  removeFacultyManagedWorkspaceRole,
  upsertFacultyManagedWorkspaceRole,
} from "./facultyManagedRolesPrefs.js";

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

  const managedId = buildFacultyManagedRoleId(contactId);

  if (assignment.kind === "composite" && assignment.composite) {
    await upsertFacultyManagedWorkspaceRole(subdomain, assignment.composite);
  } else if (isFacultyManagedRoleId(linked.role) || linked.role === managedId) {
    await removeFacultyManagedWorkspaceRole(subdomain, managedId);
  }

  const nextRole = assignment.roleId;
  const roleSource = "faculty_designations" as const;
  if (linked.role === nextRole && linked.roleSource === roleSource) {
    return { updated: false, roleId: nextRole };
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
