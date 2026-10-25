import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { tasks } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { lockFacultyHierarchy } from "./facultyAssignmentValidation.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { findTaskById } from "./tasksRepository.js";

export async function deleteTask(
  tenant: string,
  id: string,
  actorUserId?: string,
): Promise<boolean> {
  return withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    const children = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceSubdomain, tenant),
          eq(tasks.parentTaskId, id),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);
    if (children.length) throw new Error("Task has active subtasks");
    const now = new Date();
    const [changed] = await tx
      .update(tasks)
      .set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now })
      .where(and(eq(tasks.workspaceSubdomain, tenant), eq(tasks.id, id), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id });
    if (!changed) return false;
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: tenant,
      tableName: "tasks",
      recordId: id,
      actionType: "DELETE",
      realUserId: actorUserId,
    });
    await emitOutboxEvent(tx, "entity.soft_deleted", {
      entityType: "tasks",
      entityId: id,
      tenantId: tenant,
      deletedAt: now.toISOString(),
      deletedBy: actorUserId ?? "system",
      version: now.getTime(),
    });
    return true;
  });
}

export async function restoreTask(tenant: string, id: string, actorUserId: string) {
  return withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    const [current] = await tx
      .select({ parentTaskId: tasks.parentTaskId })
      .from(tasks)
      .where(
        and(eq(tasks.workspaceSubdomain, tenant), eq(tasks.id, id), isNotNull(tasks.deletedAt)),
      );
    if (!current) return null;
    if (current.parentTaskId && !(await findTaskById(tenant, current.parentTaskId))) {
      throw new Error("Restore the parent task first");
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
        and(eq(tasks.workspaceSubdomain, tenant), eq(tasks.id, id), isNotNull(tasks.deletedAt)),
      );
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: tenant,
      tableName: "tasks",
      recordId: id,
      actionType: "RESTORE",
      realUserId: actorUserId,
    });
    await emitOutboxEvent(tx, "entity.restored", {
      entityType: "tasks",
      entityId: id,
      tenantId: tenant,
      restoredAt: now.toISOString(),
      restoredBy: actorUserId,
      version: now.getTime(),
    });
    return findTaskById(tenant, id);
  });
}

export async function bulkRestoreTasks(
  tenant: string,
  ids: string[],
  actorUserId: string,
): Promise<{ restoredIds: string[] }> {
  return withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    const restoredIds: string[] = [];
    const now = new Date();
    for (const id of ids.slice(0, 500)) {
      const [current] = await tx
        .select({ parentTaskId: tasks.parentTaskId })
        .from(tasks)
        .where(
          and(eq(tasks.workspaceSubdomain, tenant), eq(tasks.id, id), isNotNull(tasks.deletedAt)),
        );
      if (!current) continue;
      if (current.parentTaskId) {
        const [parent] = await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.workspaceSubdomain, tenant),
              eq(tasks.id, current.parentTaskId),
              isNull(tasks.deletedAt),
            ),
          )
          .limit(1);
        if (!parent) continue;
      }
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
          and(eq(tasks.workspaceSubdomain, tenant), eq(tasks.id, id), isNotNull(tasks.deletedAt)),
        );
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: tenant,
        tableName: "tasks",
        recordId: id,
        actionType: "RESTORE",
        realUserId: actorUserId,
      });
      await emitOutboxEvent(tx, "entity.restored", {
        entityType: "tasks",
        entityId: id,
        tenantId: tenant,
        restoredAt: now.toISOString(),
        restoredBy: actorUserId,
        version: now.getTime(),
      });
      restoredIds.push(id);
    }
    return { restoredIds };
  });
}

/** Soft-delete multiple tasks; skips rows with active subtasks. */
export async function bulkDeleteTasks(
  tenant: string,
  ids: string[],
  actorUserId: string,
): Promise<{ deletedIds: string[] }> {
  return withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    const deletedIds: string[] = [];
    const now = new Date();
    for (const id of ids.slice(0, 500)) {
      const children = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceSubdomain, tenant),
            eq(tasks.parentTaskId, id),
            isNull(tasks.deletedAt),
          ),
        )
        .limit(1);
      if (children.length) continue;
      const [changed] = await tx
        .update(tasks)
        .set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now })
        .where(and(eq(tasks.workspaceSubdomain, tenant), eq(tasks.id, id), isNull(tasks.deletedAt)))
        .returning({ id: tasks.id });
      if (!changed) continue;
      deletedIds.push(id);
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: tenant,
        tableName: "tasks",
        recordId: id,
        actionType: "DELETE",
        realUserId: actorUserId,
      });
      await emitOutboxEvent(tx, "entity.soft_deleted", {
        entityType: "tasks",
        entityId: id,
        tenantId: tenant,
        deletedAt: now.toISOString(),
        deletedBy: actorUserId,
        version: now.getTime(),
      });
    }
    return { deletedIds };
  });
}
