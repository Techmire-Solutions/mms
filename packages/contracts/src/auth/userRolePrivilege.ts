/**
 * @file userRolePrivilege.ts
 * @description Faculty designation role collection and managed composite role helpers.
 */
import type { FacultyDesignationDefinition } from "../faculty/facultyDesignationTypes.js";
import type { FacultyEmployDesignationWriteRow } from "../faculty/facultyEmployDesignationTypes.js";
import type { WorkspaceRole } from "./userEntityTypes.js";
import { DEFAULT_WORKSPACE_ROLES_MAP, unionPermissionMaps } from "./userRbacDefaults.js";

export const FACULTY_MANAGED_ROLE_PREFIX = "faculty_ed_";

function isForbiddenSourceRole(roleId: string | undefined): boolean {
  const normalized = (roleId ?? "").trim().toLowerCase();
  return normalized === "super_admin" || normalized === "super_user";
}

export type TenureRoleSource = Pick<
  FacultyEmployDesignationWriteRow,
  "designationId" | "employDesignationStatus" | "designationEndDate"
>;

export type DesignationRoleSource = Pick<
  FacultyDesignationDefinition,
  "id" | "status" | "assignableRoles"
>;

export type FacultyRoleAssignmentKind = "none" | "catalog" | "composite";

export interface FacultyDesignationRoleAssignment {
  kind: FacultyRoleAssignmentKind;
  roleId?: string;
  sourceRoleIds: string[];
  composite?: WorkspaceRole;
}

/** True when tenure is active and not ended (open-ended). */
export function isActiveOpenEmployDesignationTenure(row: TenureRoleSource): boolean {
  if (row.employDesignationStatus !== "active") return false;
  return !row.designationEndDate?.trim();
}

/**
 * Collect distinct catalog assignable role ids from active open-ended tenures.
 * Empty assignable lists yield no id; Super Admin sources are excluded.
 */
export function collectActiveTenureAssignableRoleIds(
  employDesignations: readonly TenureRoleSource[],
  designationById: ReadonlyMap<string, DesignationRoleSource>,
): string[] {
  const out = new Set<string>();
  for (const tenure of employDesignations) {
    if (!isActiveOpenEmployDesignationTenure(tenure)) continue;
    const designationId = tenure.designationId.trim();
    if (!designationId) continue;
    const def = designationById.get(designationId);
    if (!def || def.status !== "active") continue;
    const roleId = def.assignableRoles[0]?.trim();
    if (!roleId || isForbiddenSourceRole(roleId)) continue;
    out.add(roleId);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/** Stable managed role id for a faculty-linked contact. */
export function buildFacultyManagedRoleId(contactId: string): string {
  const safe = contactId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 80);
  return `${FACULTY_MANAGED_ROLE_PREFIX}${safe || "unknown"}`;
}

export function isFacultyManagedRoleId(roleId: string | undefined): boolean {
  return Boolean(roleId?.startsWith(FACULTY_MANAGED_ROLE_PREFIX));
}

export function isFacultyManagedRole(
  role: Pick<WorkspaceRole, "id" | "managedBy"> | undefined,
): boolean {
  if (!role) return false;
  return role.managedBy === "faculty_designations" || isFacultyManagedRoleId(role.id);
}

/** Drop managed faculty composites from admin-facing role pickers. */
export function excludeFacultyManagedRoles(roles: readonly WorkspaceRole[]): WorkspaceRole[] {
  return roles.filter((r) => !isFacultyManagedRole(r));
}

/** Keep server-owned managed roles when a client Roles save omits them. */
export function preserveFacultyManagedRoles(
  incoming: readonly WorkspaceRole[],
  existing: readonly WorkspaceRole[],
): WorkspaceRole[] {
  const managed = existing.filter(isFacultyManagedRole);
  const withoutClientManaged = incoming.filter((r) => !isFacultyManagedRole(r));
  const byId = new Map(withoutClientManaged.map((r) => [r.id, r]));
  for (const role of managed) {
    if (!byId.has(role.id)) byId.set(role.id, role);
  }
  return [...byId.values()];
}

function resolveSourceRoles(
  sourceRoleIds: readonly string[],
  roleCatalog: readonly WorkspaceRole[],
): WorkspaceRole[] {
  const byId = new Map(roleCatalog.map((r) => [r.id, r]));
  return sourceRoleIds
    .map((id) => byId.get(id) ?? DEFAULT_WORKSPACE_ROLES_MAP[id])
    .filter((r): r is WorkspaceRole => Boolean(r) && !isForbiddenSourceRole(r.id));
}

function compositeLabel(sourceRoles: readonly WorkspaceRole[]): string {
  const names = sourceRoles.map((r) => r.customLabel?.trim() || r.id.replace(/_/g, " "));
  return `Faculty (${names.join(" + ")})`;
}

/** Build or refresh a per-contact managed composite role. */
export function buildFacultyCompositeRole(input: {
  contactId: string;
  sourceRoles: readonly WorkspaceRole[];
}): WorkspaceRole {
  const sourceRoleIds = [...new Set(input.sourceRoles.map((r) => r.id))].sort((a, b) =>
    a.localeCompare(b),
  );
  return {
    id: buildFacultyManagedRoleId(input.contactId),
    labelKey: "users.role.custom",
    descriptionKey: "users.role.customDesc",
    customLabel: compositeLabel(input.sourceRoles),
    customDescription:
      "Managed from faculty designations; permissions are the union of source roles.",
    isSystem: false,
    badgeVariant: "primary",
    permissions: unionPermissionMaps(input.sourceRoles.map((r) => r.permissions)),
    managedBy: "faculty_designations",
    sourceRoleIds,
  };
}

/**
 * Resolve how a faculty contact's user role should be assigned from designations.
 * 0 sources → none; 1 → catalog role; 2+ → managed composite.
 */
export function resolveFacultyDesignationRoleAssignment(
  contactId: string,
  employDesignations: readonly TenureRoleSource[],
  designations: readonly DesignationRoleSource[],
  roleCatalog: readonly WorkspaceRole[] = [],
): FacultyDesignationRoleAssignment {
  const byId = new Map(designations.map((d) => [d.id, d]));
  const sourceRoleIds = collectActiveTenureAssignableRoleIds(employDesignations, byId);
  if (sourceRoleIds.length === 0) return { kind: "none", sourceRoleIds: [] };
  if (sourceRoleIds.length === 1) {
    return { kind: "catalog", roleId: sourceRoleIds[0], sourceRoleIds };
  }
  const sourceRoles = resolveSourceRoles(sourceRoleIds, roleCatalog);
  if (sourceRoles.length === 0) return { kind: "none", sourceRoleIds: [] };
  if (sourceRoles.length === 1) {
    return { kind: "catalog", roleId: sourceRoles[0]!.id, sourceRoleIds: [sourceRoles[0]!.id] };
  }
  const composite = buildFacultyCompositeRole({ contactId, sourceRoles });
  return { kind: "composite", roleId: composite.id, sourceRoleIds, composite };
}

/** Refresh permissions on existing managed composites from current catalog roles. */
export function refreshFacultyManagedRolePermissions(
  roles: readonly WorkspaceRole[],
  roleCatalog: readonly WorkspaceRole[],
): WorkspaceRole[] {
  return roles.map((role) => {
    if (!isFacultyManagedRole(role) || !role.sourceRoleIds?.length) return role;
    const sourceRoles = resolveSourceRoles(role.sourceRoleIds, roleCatalog);
    if (sourceRoles.length === 0) return role;
    return {
      ...role,
      permissions: unionPermissionMaps(sourceRoles.map((r) => r.permissions)),
      customLabel: compositeLabel(sourceRoles),
      sourceRoleIds: sourceRoles.map((r) => r.id).sort((a, b) => a.localeCompare(b)),
      managedBy: "faculty_designations" as const,
    };
  });
}
