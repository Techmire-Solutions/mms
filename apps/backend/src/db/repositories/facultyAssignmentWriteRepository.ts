import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { and, eq, isNull } from "drizzle-orm";
import { facultyAssignments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import type { InsertFacultyAssignmentRow } from "../schema/facultyAssignmentTables.js";
import {
  assertFacultyAssignmentDeletable,
  lockFacultyHierarchy,
  validateFacultyAssignment,
} from "./facultyAssignmentValidation.js";
import { findFacultyAssignmentById } from "./facultyAssignmentRepository.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { workspaceTodayIso } from "../../lib/workspaceDay.js";

export async function saveFacultyAssignment(
  tenant: string,
  assignment: InsertFacultyAssignmentRow,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    await validateFacultyAssignment(tx, subdomain, assignment);
    // An upsert cannot tell an insert from an edit; read the row first so a new
    // appointment is audited as CREATE, not UPDATE.
    const [existing] = await tx
      .select({ id: facultyAssignments.id })
      .from(facultyAssignments)
      .where(
        and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.id, assignment.id),
        ),
      )
      .limit(1);
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
      actionType: existing ? "UPDATE" : "CREATE",
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
    // The row that currently backs the faculty's primary appointment must be
    // closed (end date), never archived: the primary row is the SSOT for the
    // Work projection, exports, task delegation and contact role tags.
    const [current] = await tx
      .select({
        isPrimary: facultyAssignments.isPrimary,
        startDate: facultyAssignments.startDate,
        endDate: facultyAssignments.endDate,
        deletedAt: facultyAssignments.deletedAt,
      })
      .from(facultyAssignments)
      .where(
        and(
          eq(facultyAssignments.workspaceSubdomain, subdomain),
          eq(facultyAssignments.id, id),
          isNull(facultyAssignments.deletedAt),
        ),
      )
      .for("update");
    if (!current) return;
    assertFacultyAssignmentDeletable(current, await workspaceTodayIso(subdomain));
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
