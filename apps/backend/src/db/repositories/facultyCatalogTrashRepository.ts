import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { FacultyDepartmentEntity, FacultyDesignationDefinition } from "@mms/shared";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { facultyDepartments, facultyDesignations } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { selectDepartmentById } from "./facultyDepartmentRepository.js";
import { FacultyCatalogConflictError } from "./facultyDepartmentValidation.js";
import { selectDesignationById } from "./facultyDesignationRepository.js";
import { lockFacultyHierarchy } from "./facultyAssignmentValidation.js";

const RESTORE_PATCH = (now: Date, actorUserId: string) => ({
  deletedAt: null,
  deletedBy: null,
  deletionReason: null,
  restoredAt: now,
  restoredBy: actorUserId,
  deletedWithCascade: false,
  status: "active",
  isActive: true,
  updatedAt: now,
});

async function recordRestore(
  tx: TenantTransaction,
  subdomain: string,
  tableName: "faculty_departments" | "faculty_designations",
  id: string,
  actorUserId: string,
  now: Date,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName,
    recordId: id,
    actionType: "RESTORE",
    realUserId: actorUserId,
  });
  await emitOutboxEvent(tx, "entity.restored", {
    entityType: tableName,
    entityId: id,
    tenantId: subdomain,
    restoredAt: now.toISOString(),
    restoredBy: actorUserId,
    version: now.getTime(),
  });
}

/** Restores a soft-deleted faculty department (name must still be unique among live rows). */
export async function restoreFacultyDepartment(
  tenant: string,
  id: string,
  actorUserId: string,
): Promise<FacultyDepartmentEntity | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const [current] = await tx
      .select({ name: facultyDepartments.name })
      .from(facultyDepartments)
      .where(
        and(
          eq(facultyDepartments.workspaceSubdomain, subdomain),
          eq(facultyDepartments.id, id),
          isNotNull(facultyDepartments.deletedAt),
        ),
      );
    if (!current) return null;
    const duplicate = await tx.execute<{ id: string }>(sql`
      SELECT id FROM faculty_departments WHERE workspace_subdomain = ${subdomain} AND id <> ${id}
        AND deleted_at IS NULL AND lower(btrim(name)) = lower(btrim(${current.name})) LIMIT 1
    `);
    if (duplicate.rows.length) {
      throw new FacultyCatalogConflictError(
        "A department with this name already exists — rename it before restoring",
      );
    }
    const now = new Date();
    await tx
      .update(facultyDepartments)
      .set(RESTORE_PATCH(now, actorUserId))
      .where(
        and(
          eq(facultyDepartments.workspaceSubdomain, subdomain),
          eq(facultyDepartments.id, id),
          isNotNull(facultyDepartments.deletedAt),
        ),
      );
    await recordRestore(tx, subdomain, "faculty_departments", id, actorUserId, now);
    return selectDepartmentById(tx, subdomain, id);
  });
}

/** Restores a soft-deleted faculty designation (its department and parent must be live). */
export async function restoreFacultyDesignation(
  tenant: string,
  id: string,
  actorUserId: string,
): Promise<FacultyDesignationDefinition | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const [current] = await tx
      .select({
        departmentId: facultyDesignations.departmentId,
        parentDesignationId: facultyDesignations.parentDesignationId,
      })
      .from(facultyDesignations)
      .where(
        and(
          eq(facultyDesignations.workspaceSubdomain, subdomain),
          eq(facultyDesignations.id, id),
          isNotNull(facultyDesignations.deletedAt),
        ),
      );
    if (!current) return null;
    if (
      current.departmentId &&
      !(await selectDepartmentById(tx, subdomain, current.departmentId))
    ) {
      throw new Error("Restore the department first");
    }
    if (
      current.parentDesignationId &&
      !(await selectDesignationById(tx, subdomain, current.parentDesignationId))
    ) {
      throw new Error("Restore the parent designation first");
    }
    const now = new Date();
    await tx
      .update(facultyDesignations)
      .set(RESTORE_PATCH(now, actorUserId))
      .where(
        and(
          eq(facultyDesignations.workspaceSubdomain, subdomain),
          eq(facultyDesignations.id, id),
          isNotNull(facultyDesignations.deletedAt),
        ),
      );
    await recordRestore(tx, subdomain, "faculty_designations", id, actorUserId, now);
    return selectDesignationById(tx, subdomain, id);
  });
}
