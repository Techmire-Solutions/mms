import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { tasks } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { lockFacultyHierarchy } from "./facultyAssignmentValidation.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { findTaskById } from "./tasksRepository.js";
import { ConflictError, ForbiddenError } from "../../lib/httpErrors.js";

export async function deleteTask(
  tenant: string,
  id: string,
  actorUserId?: string,
  canAssignAnywhere = false,
): Promise<"deleted" | "already_deleted" | "not_found"> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const [target] = await tx
      .select({ createdByUserId: tasks.createdByUserId, deletedAt: tasks.deletedAt })
      .from(tasks)
      .where(and(eq(tasks.workspaceSubdomain, subdomain), eq(tasks.id, id)));
    if (!target) return "not_found";
    if (target.deletedAt) return "already_deleted";
    if (!canAssignAnywhere && target.createdByUserId !== actorUserId) {
      throw new ForbiddenError("You do not have permission to archive this task");
    }
    const children = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceSubdomain, subdomain),
          eq(tasks.parentTaskId, id),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);
    if (children.length) throw new ConflictError("Task has active subtasks");
    const now = new Date();
    const [changed] = await tx
      .update(tasks)
      .set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now })
      .where(
        and(eq(tasks.workspaceSubdomain, subdomain), eq(tasks.id, id), isNull(tasks.deletedAt)),
      )
      .returning({ id: tasks.id });
    if (changed) {
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: subdomain,
        tableName: "tasks",
        recordId: id,
        actionType: "DELETE",
        realUserId: actorUserId,
      });
      await emitOutboxEvent(tx, "entity.soft_deleted", {
        entityType: "tasks",
        entityId: id,
        tenantId: subdomain,
        deletedAt: now.toISOString(),
        deletedBy: actorUserId ?? "system",
        version: now.getTime(),
      });
      return "deleted";
    }
    return "already_deleted";
  });
}

export async function restoreTask(
  tenant: string,
  id: string,
  actorUserId: string,
  canAssignAnywhere = false,
) {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const [current] = await tx
      .select({ parentTaskId: tasks.parentTaskId, createdByUserId: tasks.createdByUserId })
      .from(tasks)
      .where(
        and(eq(tasks.workspaceSubdomain, subdomain), eq(tasks.id, id), isNotNull(tasks.deletedAt)),
      );
    if (!current) return null;
    if (!canAssignAnywhere && current.createdByUserId !== actorUserId) {
      throw new ForbiddenError("You do not have permission to restore this task");
    }
    if (current.parentTaskId && !(await findTaskById(subdomain, current.parentTaskId))) {
      throw new ConflictError("Restore the parent task first");
    }
    const now = new Date();
    await tx
      .update(tasks)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy: actorUserId,
        updatedAt: now,
      })
      .where(
        and(eq(tasks.workspaceSubdomain, subdomain), eq(tasks.id, id), isNotNull(tasks.deletedAt)),
      );
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "tasks",
      recordId: id,
      actionType: "RESTORE",
      realUserId: actorUserId,
    });
    await emitOutboxEvent(tx, "entity.restored", {
      entityType: "tasks",
      entityId: id,
      tenantId: subdomain,
      restoredAt: now.toISOString(),
      restoredBy: actorUserId,
      version: now.getTime(),
    });
    return findTaskById(subdomain, id);
  });
}
