import { and, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import {
  isTaskStatusTransitionAllowed,
  type TaskInsert,
  type TaskStatus,
  type TaskUpdate,
} from "@mms/contracts";
import { tasks } from "@mms/db/schema";
import { withTenant, type TenantTransaction } from "@mms/db/context";
import { findTaskById } from "./tasksRepository.js";
import { syncTaskAssignees } from "./tasksAssigneesRepository.js";
import { lockFacultyHierarchy } from "./facultyAssignmentValidation.js";
import { recordModernAuditEvent } from "@mms/be-core/audit";
import { ConflictError, ValidationError } from "@mms/be-core/http/errors";
import { naiveTimestamp } from "../../lib/dbDate.js";

type Recipients = Parameters<typeof syncTaskAssignees>[3];

function lifecycle(status: TaskStatus, now: Date) {
  return {
    completedAt: status === "completed" ? now : null,
    cancelledAt: status === "cancelled" ? now : null,
  };
}

/** `startDate` (a date-only `YYYY-MM-DD`) must not be after `dueAt`'s UTC day (m1). */
function assertValidDateRange(
  startDate: string | null | undefined,
  dueAt: Date | null | undefined,
): void {
  if (!startDate || !dueAt) return;
  if (startDate > dueAt.toISOString().slice(0, 10)) {
    throw new ValidationError("Due date must be after the start date");
  }
}

/** A task cannot be completed while it still has active, unresolved subtasks (A1). */
async function assertNoUnresolvedSubtasks(
  tx: TenantTransaction,
  tenant: string,
  taskId: string,
  force: boolean,
): Promise<void> {
  if (force) return;
  const [child] = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceSubdomain, tenant),
        eq(tasks.parentTaskId, taskId),
        isNull(tasks.deletedAt),
        notInArray(tasks.status, ["completed", "cancelled"]),
      ),
    )
    .limit(1);
  if (child) throw new ConflictError("Complete the task's subtasks first");
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
    throw new ValidationError("Invalid parent task");
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
    assertValidDateRange(data.startDate, data.dueAt ? new Date(data.dueAt) : null);
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
        title: data.title,
        status: data.status,
        priority: data.priority,
        dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : null,
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
  expectedUpdatedAt?: string,
) {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await validateParent(tx, subdomain, id, data.parentTaskId);
    const current = await findTaskById(subdomain, id);
    if (!current) return null;
    const nextStartDate = data.startDate !== undefined ? data.startDate : current.startDate;
    const nextDueAt = data.dueAt !== undefined ? data.dueAt : current.dueAt;
    assertValidDateRange(nextStartDate, nextDueAt ? new Date(nextDueAt) : null);
    const versionToken = expectedUpdatedAt?.trim();
    const expectedDate = versionToken ? new Date(versionToken) : null;
    if (versionToken && (!expectedDate || Number.isNaN(expectedDate.getTime()))) {
      throw new ValidationError("Invalid x-expected-updated-at header");
    }
    const payload: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: actorUserId,
    };
    if (data.title !== undefined) payload.title = data.title;
    if (data.description !== undefined) payload.description = data.description;
    if (
      data.status !== undefined &&
      data.status !== current.status &&
      !isTaskStatusTransitionAllowed(current.status, data.status)
    ) {
      throw new ValidationError(`Invalid status transition: ${current.status} → ${data.status}`);
    }
    if (data.status !== undefined) {
      payload.status = data.status;
      if (data.status !== current.status) {
        if (data.status === "completed") {
          await assertNoUnresolvedSubtasks(tx, subdomain, id, data.forceCompleteSubtasks === true);
        }
        Object.assign(payload, lifecycle(data.status, new Date()));
      }
    }
    if (data.priority !== undefined) payload.priority = data.priority;
    if (data.startDate !== undefined) payload.startDate = data.startDate;
    if (data.dueAt !== undefined) payload.dueAt = data.dueAt ? new Date(data.dueAt) : null;
    if (data.parentTaskId !== undefined) payload.parentTaskId = data.parentTaskId;
    if (recipients !== undefined) payload.assignedByUserId = actorUserId;
    const versionPredicate = expectedDate
      ? or(
          sql`date_trunc('milliseconds', ${tasks.updatedAt}) = ${naiveTimestamp(expectedDate)}::timestamp`,
          sql`date_trunc('milliseconds', ${tasks.updatedAt}) = ${expectedDate}::timestamptz`,
        )
      : undefined;
    const updatedRows = await tx
      .update(tasks)
      .set(payload)
      .where(
        and(
          eq(tasks.workspaceSubdomain, subdomain),
          eq(tasks.id, id),
          isNull(tasks.deletedAt),
          versionPredicate,
        ),
      )
      .returning({ id: tasks.id });
    if (updatedRows.length === 0 && expectedDate) {
      // A stale version token is a conflict, not a missing task (`mms-api-interface` §6).
      throw new ConflictError("This task was changed by someone else. Reload it and try again.");
    }
    if (recipients !== undefined)
      await syncTaskAssignees(tx, subdomain, id, recipients, actorUserId);
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "tasks",
      recordId: id,
      actionType: "UPDATE",
      realUserId: actorUserId,
      oldState: {
        title: current.title,
        status: current.status,
        priority: current.priority,
        dueAt: current.dueAt,
      },
      newState: {
        title: data.title ?? current.title,
        status: data.status ?? current.status,
        priority: data.priority ?? current.priority,
        dueAt:
          data.dueAt !== undefined
            ? data.dueAt
              ? new Date(data.dueAt).toISOString()
              : null
            : current.dueAt,
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
  expectedUpdatedAt?: string,
) {
  return updateTask(tenant, id, { status }, undefined, actorUserId, expectedUpdatedAt);
}
