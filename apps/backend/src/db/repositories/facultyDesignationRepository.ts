import { and, asc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import type {
  FacultyCatalogStatus,
  FacultyDesignationDefinition,
  FacultyDesignationWrite,
} from "@mms/shared";
import { facultyDepartments, facultyDesignationRoles, facultyDesignations } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { resolveFacultyCatalogCode } from "./facultyDepartmentValidation.js";
import {
  recomputeDescendantRanks,
  validateDesignationDeletion,
  validateFacultyDesignation,
} from "./facultyDesignationValidation.js";
import { replaceFacultyDesignationRoles } from "./facultyDesignationRolesWrite.js";

export {
  listFacultyDesignationAssignments,
  findCurrentFacultyDesignationAssignment,
} from "./facultyDesignationAssignmentRepository.js";

const parentDesignations = alias(facultyDesignations, "parent_designation");

const DESIGNATION_COLUMNS = {
  id: facultyDesignations.id,
  departmentId: facultyDesignations.departmentId,
  departmentName: facultyDepartments.name,
  parentDesignationId: facultyDesignations.parentDesignationId,
  parentDesignationName: parentDesignations.name,
  name: facultyDesignations.name,
  status: facultyDesignations.status,
  code: facultyDesignations.code,
  hierarchyRank: facultyDesignations.hierarchyRank,
  isActive: facultyDesignations.isActive,
  deletedAt: facultyDesignations.deletedAt,
  createdAt: facultyDesignations.createdAt,
  updatedAt: facultyDesignations.updatedAt,
};

type DesignationSelection = {
  id: string;
  departmentId: string | null;
  departmentName: string | null;
  parentDesignationId: string | null;
  parentDesignationName: string | null;
  name: string;
  status: string;
  code: string | null;
  hierarchyRank: number;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDesignation(
  row: DesignationSelection,
  assignableRoles: string[],
): FacultyDesignationDefinition {
  const status: FacultyCatalogStatus = row.status === "inactive" ? "inactive" : "active";
  return {
    id: row.id,
    departmentId: row.departmentId ?? "",
    departmentName: row.departmentName ?? undefined,
    parentDesignationId: row.parentDesignationId,
    parentDesignationName: row.parentDesignationName,
    name: row.name,
    status,
    hierarchyRank: row.hierarchyRank,
    isActive: status === "active",
    code: row.code,
    assignableRoles: assignableRoles.slice(0, 1),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function designationQuery(tx: TenantTransaction) {
  return tx
    .select(DESIGNATION_COLUMNS)
    .from(facultyDesignations)
    .leftJoin(
      facultyDepartments,
      and(
        eq(facultyDepartments.workspaceSubdomain, facultyDesignations.workspaceSubdomain),
        eq(facultyDepartments.id, facultyDesignations.departmentId),
      ),
    )
    .leftJoin(
      parentDesignations,
      and(
        eq(parentDesignations.workspaceSubdomain, facultyDesignations.workspaceSubdomain),
        eq(parentDesignations.id, facultyDesignations.parentDesignationId),
      ),
    );
}

async function loadRolesByDesignation(
  tx: TenantTransaction,
  workspaceSubdomain: string,
): Promise<Map<string, string[]>> {
  const roles = await tx
    .select({
      designationId: facultyDesignationRoles.designationId,
      roleKey: facultyDesignationRoles.roleKey,
    })
    .from(facultyDesignationRoles)
    .where(eq(facultyDesignationRoles.workspaceSubdomain, workspaceSubdomain))
    .orderBy(asc(facultyDesignationRoles.roleKey));
  const byDesignation = new Map<string, string[]>();
  for (const role of roles) {
    byDesignation.set(role.designationId, [
      ...(byDesignation.get(role.designationId) ?? []),
      role.roleKey,
    ]);
  }
  return byDesignation;
}

/** Reads one live designation (with department / parent names) inside an existing transaction. */
export async function selectDesignationById(
  tx: TenantTransaction,
  workspaceSubdomain: string,
  id: string,
): Promise<FacultyDesignationDefinition | null> {
  const [row] = await designationQuery(tx)
    .where(
      and(
        eq(facultyDesignations.workspaceSubdomain, workspaceSubdomain),
        eq(facultyDesignations.id, id),
        isNull(facultyDesignations.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  const roles = await loadRolesByDesignation(tx, workspaceSubdomain);
  return toDesignation(row, roles.get(id) ?? []);
}

/** Default API cap; pass `limit: null` for export/import/hydrate that need the full catalog. */
const FACULTY_DESIGNATION_LIST_DEFAULT_LIMIT = 500;
const FACULTY_DESIGNATION_LIST_MAX_LIMIT = 5000;

/** Lists designations ordered by department, hierarchy depth, then name. */
export async function listFacultyDesignations(
  tenant: string,
  options: { includeDeleted?: boolean; limit?: number | null } = {},
): Promise<FacultyDesignationDefinition[]> {
  const workspaceSubdomain = tenant.trim().toLowerCase();
  return withTenantRead(workspaceSubdomain, async (tx) => {
    const where = options.includeDeleted
      ? eq(facultyDesignations.workspaceSubdomain, workspaceSubdomain)
      : and(
          eq(facultyDesignations.workspaceSubdomain, workspaceSubdomain),
          isNull(facultyDesignations.deletedAt),
        );
    const ordered = designationQuery(tx)
      .where(where)
      .orderBy(
        asc(facultyDepartments.name),
        asc(facultyDesignations.hierarchyRank),
        asc(facultyDesignations.name),
      );
    const [rows, roles] = await Promise.all([
      options.limit === null
        ? ordered
        : ordered.limit(
            Math.min(
              Math.max(1, options.limit ?? FACULTY_DESIGNATION_LIST_DEFAULT_LIMIT),
              FACULTY_DESIGNATION_LIST_MAX_LIMIT,
            ),
          ),
      loadRolesByDesignation(tx, workspaceSubdomain),
    ]);
    return rows.map((row) => toDesignation(row, roles.get(row.id) ?? []));
  });
}

/** Upserts a designation; `hierarchyRank`, `code` and `isActive` are derived server-side. */
export async function saveFacultyDesignation(
  tenant: string,
  input: FacultyDesignationWrite & { updatedBy?: string | null },
): Promise<FacultyDesignationDefinition> {
  const workspaceSubdomain = tenant.trim().toLowerCase();
  const name = input.name.trim();
  const parentDesignationId = input.parentDesignationId ?? null;
  const status: FacultyCatalogStatus = input.status ?? "active";
  return withTenant(workspaceSubdomain, async (tx) => {
    const { hierarchyRank } = await validateFacultyDesignation(tx, workspaceSubdomain, {
      id: input.id,
      departmentId: input.departmentId,
      name,
      parentDesignationId,
    });
    const code = await resolveFacultyCatalogCode(
      tx,
      "faculty_designations",
      workspaceSubdomain,
      input.id,
      name,
    );
    const values = {
      departmentId: input.departmentId,
      parentDesignationId,
      name,
      status,
      code,
      hierarchyRank,
      isActive: status === "active",
    };
    await tx
      .insert(facultyDesignations)
      .values({ workspaceSubdomain, id: input.id, ...values })
      .onConflictDoUpdate({
        target: [facultyDesignations.workspaceSubdomain, facultyDesignations.id],
        setWhere: isNull(facultyDesignations.deletedAt),
        set: { ...values, updatedAt: new Date() },
      });
    if (input.assignableRoles !== undefined) {
      await replaceFacultyDesignationRoles(tx, workspaceSubdomain, input.id, input.assignableRoles);
    }
    await recomputeDescendantRanks(tx, workspaceSubdomain, input.id);
    await recordModernAuditEvent(tx, {
      workspaceSubdomain,
      tableName: "faculty_designations",
      recordId: input.id,
      actionType: "UPDATE",
      realUserId: input.updatedBy ?? undefined,
      newState: { id: input.id, ...values, assignableRoles: input.assignableRoles },
    });
    const saved = await selectDesignationById(tx, workspaceSubdomain, input.id);
    if (!saved) throw new Error("Designation could not be loaded after save");
    return saved;
  });
}

export async function softDeleteFacultyDesignation(
  tenant: string,
  id: string,
  actor: string,
): Promise<void> {
  const workspaceSubdomain = tenant.trim().toLowerCase();
  await withTenant(workspaceSubdomain, async (tx) => {
    await validateDesignationDeletion(tx, workspaceSubdomain, id);
    const deletedAt = new Date();
    const changed = await tx
      .update(facultyDesignations)
      .set({
        deletedAt,
        deletedBy: actor,
        status: "inactive",
        isActive: false,
        updatedAt: deletedAt,
      })
      .where(
        and(
          eq(facultyDesignations.workspaceSubdomain, workspaceSubdomain),
          eq(facultyDesignations.id, id),
          isNull(facultyDesignations.deletedAt),
        ),
      )
      .returning({ id: facultyDesignations.id });
    if (!changed.length) throw new Error("Designation not found");
    await recordModernAuditEvent(tx, {
      workspaceSubdomain,
      tableName: "faculty_designations",
      recordId: id,
      actionType: "DELETE",
      realUserId: actor,
      newState: { deletedAt },
    });
    await emitOutboxEvent(tx, "entity.soft_deleted", {
      entityType: "faculty_designations",
      entityId: id,
      tenantId: workspaceSubdomain,
      deletedAt: deletedAt.toISOString(),
      deletedBy: actor,
      version: deletedAt.getTime(),
    });
  });
}
