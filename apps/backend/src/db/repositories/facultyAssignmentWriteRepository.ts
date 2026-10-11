import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { and, eq, isNull } from "drizzle-orm";
import { facultyAssignments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import type { InsertFacultyAssignmentRow } from "../schema/facultyAssignmentTables.js";
import { validateFacultyAssignment, lockFacultyHierarchy } from "./facultyAssignmentValidation.js";
import { findFacultyAssignmentById } from "./facultyAssignmentRepository.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

export async function saveFacultyAssignment(
  tenant: string,
  assignment: InsertFacultyAssignmentRow,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    await validateFacultyAssignment(tx, subdomain, assignment);
    await tx
      .insert(facultyAssignments)
      .values({ ...assignment, workspaceSubdomain: subdomain })
      .onConflictDoUpdate({
        target: [facultyAssignments.workspaceSubdomain, facultyAssignments.id],
        set: {
          departmentId: assignment.departmentId,
          designationId: assignment.designationId,
          isPrimary: assignment.isPrimary,
          status: assignment.status ?? "active",
          startDate: assignment.startDate,
          endDate: assignment.endDate ?? null,
          notes: assignment.notes ?? null,
          updatedAt: new Date(),
          updatedBy: assignment.updatedBy ?? null,
        },
      });
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "faculty_assignments",
      recordId: assignment.id,
      actionType: "UPDATE",
      realUserId: assignment.updatedBy,
      newState: assignment,
    });
  });
}

export async function closeAssignment(
  tenant: string,
  id: string,
  endDate: string,
  updatedBy?: string,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const current = await findFacultyAssignmentById(subdomain, id);
    if (!current) throw new Error("Assignment not found");
    await validateFacultyAssignment(tx, subdomain, { ...current, endDate });
    await tx
      .update(facultyAssignments)
      .set({ endDate, updatedAt: new Date(), updatedBy: updatedBy ?? null })
      .where(
        and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.id, id),
          isNull(facultyAssignments.deletedAt),
        ),
      );
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "faculty_assignments",
      recordId: id,
      actionType: "UPDATE",
      realUserId: updatedBy,
      newState: { endDate },
    });
  });
}

export async function softDeleteFacultyAssignment(
  tenant: string,
  id: string,
  deletedBy: string,
  reason?: string,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const deletedAt = new Date();
    const changed = await tx
      .update(facultyAssignments)
      .set({ deletedAt, deletedBy, deletionReason: reason ?? null, updatedAt: new Date() })
      .where(
        and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.id, id),
          isNull(facultyAssignments.deletedAt),
        ),
      )
      .returning({ id: facultyAssignments.id, facultyId: facultyAssignments.facultyId });
    if (!changed.length) return;
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "faculty_assignments",
      recordId: id,
      actionType: "DELETE",
      realUserId: deletedBy,
      newState: { reason },
    });
    await emitOutboxEvent(tx, "entity.soft_deleted", {
      entityType: "faculty_assignments",
      entityId: id,
      tenantId: subdomain,
      deletedAt: deletedAt.toISOString(),
      deletedBy,
      deletionReason: reason,
      version: deletedAt.getTime(),
    });
  });
}
