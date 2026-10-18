import { and, eq, isNull, sql } from "drizzle-orm";
import type { TaskInsert, TaskUpdate, TaskStatus } from "@mms/shared";
import { tasks } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { findTaskById } from "./tasksRepository.js";
import { syncTaskAssignees } from "./tasksAssigneesRepository.js";
import { lockFacultyHierarchy } from "./facultyAssignmentValidation.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

type Recipients = Parameters<typeof syncTaskAssignees>[3];

function lifecycle(status: TaskStatus, now: Date) {
  return {
    completedAt: status === "completed" ? now : null,
    cancelledAt: status === "cancelled" ? now : null,
  };
}

async function validateParent(
  tx: TenantTransaction,
  tenant: string,
  id: string,
  parent?: string | null,
) {
  await lockFacultyHierarchy(tx, tenant);
  if (!parent) return;
  const result = await tx.execute<{ id: string; parent_id: string | null; cycle: boolean }>(sql`
    WITH RECURSIVE chain AS (
      SELECT id, parent_task_id AS parent_id, ARRAY[id] AS path, FALSE AS cycle, 0 AS depth
      FROM tasks WHERE workspace_subdomain = ${tenant} AND id = ${parent} AND deleted_at IS NULL
      UNION ALL
      SELECT p.id, p.parent_task_id, array_append(c.path, p.id), p.id = ANY(c.path), c.depth + 1
      FROM chain c JOIN tasks p ON p.id = c.parent_id
      WHERE p.workspace_subdomain = ${tenant} AND p.deleted_at IS NULL AND NOT c.cycle AND c.depth < 20
    ) SELECT id, parent_id, cycle FROM chain
  `);
  const visited = new Set(result.rows.map((row) => row.id));
  if (
    !result.rows.length ||
    result.rows.some(
      (row) => row.id === id || row.cycle || (row.parent_id && !visited.has(row.parent_id)),
    )
  )
    throw new Error("Invalid parent task");
}

export async function createTask(
  tenant: string,
  data: TaskInsert,
  recipients: Recipients,
  actorUserId?: string,
) {
  const subdomain = tenant.trim().toLowerCase();
  const id = crypto.randomUUID();
  return withTenant(subdomain, async (tx) => {
    await validateParent(tx, subdomain, id, data.parentTaskId);
    await tx.insert(tasks).values({
      id,
      workspaceSubdomain: subdomain,
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      startDate: data.startDate ?? null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      parentTaskId: data.parentTaskId ?? null,
      createdByUserId: actorUserId ?? "system",
      assignedByUserId: recipients.length ? actorUserId : null,
      createdBy: actorUserId,
      updatedBy: actorUserId,
      ...lifecycle(data.status, new Date()),
    });
    await syncTaskAssignees(tx, subdomain, id, recipients, actorUserId);
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "tasks",
      recordId: id,
      actionType: "CREATE",
      realUserId: actorUserId,
      newState: {
        status: data.status,
        priority: data.priority,
        recipients: recipients.map((recipient) => recipient.userId),
      },
    });
    const created = await findTaskById(subdomain, id);
    if (!created) throw new Error("Task creation verification failed");
    return created;
  });
}

export async function updateTask(
  tenant: string,
  id: string,
  data: TaskUpdate,
  recipients?: Recipients,
  actorUserId?: string,
) {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await validateParent(tx, subdomain, id, data.parentTaskId);
    const current = await findTaskById(subdomain, id);
    if (!current) return null;
    const payload: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: actorUserId,
    };
    if (data.title !== undefined) payload.title = data.title;
    if (data.description !== undefined) payload.description = data.description;
    if (data.status !== undefined) {
      payload.status = data.status;
      if (data.status !== current.status)
        Object.assign(payload, lifecycle(data.status, new Date()));
    }
    if (data.priority !== undefined) payload.priority = data.priority;
    if (data.startDate !== undefined) payload.startDate = data.startDate;
    if (data.dueAt !== undefined) payload.dueAt = data.dueAt ? new Date(data.dueAt) : null;
    if (data.parentTaskId !== undefined) payload.parentTaskId = data.parentTaskId;
    if (recipients !== undefined) payload.assignedByUserId = actorUserId;
    await tx
      .update(tasks)
      .set(payload)
      .where(
        and(eq(tasks.workspaceSubdomain, subdomain), eq(tasks.id, id), isNull(tasks.deletedAt)),
      );
    if (recipients !== undefined)
      await syncTaskAssignees(tx, subdomain, id, recipients, actorUserId);
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "tasks",
      recordId: id,
      actionType: "UPDATE",
      realUserId: actorUserId,
      oldState: { status: current.status, priority: current.priority },
      newState: {
        status: data.status ?? current.status,
        priority: data.priority ?? current.priority,
        ...(recipients ? { recipients: recipients.map((recipient) => recipient.userId) } : {}),
      },
    });
    return findTaskById(subdomain, id);
  });
}

export async function updateTaskStatus(
  tenant: string,
  id: string,
  status: TaskStatus,
  actorUserId?: string,
) {
  return updateTask(tenant, id, { status }, undefined, actorUserId);
}
