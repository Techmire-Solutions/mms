/**
 * @file facultyUserRoleGuards.ts
 * @description Faculty designation-driven role lock and assignment resolution for Users.
 */
import {
  collectActiveTenureAssignableRoleIds,
  DEFAULT_WORKSPACE_ROLES,
  isFacultyProfileStatus,
  resolveFacultyDesignationRoleAssignment,
  type FacultyEmployDesignationWriteRow,
  type FacultyMember,
} from "@mms/shared";
import { findFacultyByContactId } from "../../db/repositories/facultyRepository.js";
import { listFacultyDesignations } from "../../db/repositories/facultyDesignationRepository.js";
import { getTenantUsersSettings } from "../../services/users/usersSettingsService.js";

function tenureRowsFromFaculty(faculty: FacultyMember): FacultyEmployDesignationWriteRow[] {
  if (Array.isArray(faculty.employDesignations) && faculty.employDesignations.length > 0) {
    return faculty.employDesignations;
  }
  const designationId = faculty.designationId != null ? String(faculty.designationId).trim() : "";
  if (!designationId) return [];
  return [
    {
      designationId,
      designationStartDate: faculty.designationStartDate ?? null,
      designationEndDate: faculty.designationEndDate ?? null,
      employDesignationStatus: isFacultyProfileStatus(faculty.employDesignationStatus)
        ? faculty.employDesignationStatus
        : isFacultyProfileStatus(faculty.profileStatus)
          ? faculty.profileStatus
          : "active",
      employDesignationId: faculty.employDesignationId ?? null,
    },
  ];
}

/** True when faculty contact has ≥1 active open tenure with an assignable role. */
export async function isFacultyDesignationRoleLocked(
  tenant: string,
  contactId: string | undefined,
): Promise<boolean> {
  if (!contactId?.trim()) return false;
  const faculty = await findFacultyByContactId(tenant, contactId.trim());
  if (!faculty) return false;
  const definitions = await listFacultyDesignations(tenant);
  const byId = new Map(definitions.map((d) => [d.id, d]));
  const roles = collectActiveTenureAssignableRoleIds(tenureRowsFromFaculty(faculty), byId);
  return roles.length > 0;
}

/** Resolved designation role assignment for a faculty-linked contact, or null. */
export async function resolveFacultyContactRoleAssignment(
  tenant: string,
  contactId: string,
): Promise<ReturnType<typeof resolveFacultyDesignationRoleAssignment> | null> {
  const faculty = await findFacultyByContactId(tenant, contactId.trim());
  if (!faculty) return null;
  const designations = await listFacultyDesignations(tenant);
  const settings = await getTenantUsersSettings();
  const roleCatalog = settings.workspaceRoles?.length
    ? settings.workspaceRoles
    : [...DEFAULT_WORKSPACE_ROLES];
  return resolveFacultyDesignationRoleAssignment(
    contactId.trim(),
    tenureRowsFromFaculty(faculty),
    designations,
    roleCatalog,
  );
}
