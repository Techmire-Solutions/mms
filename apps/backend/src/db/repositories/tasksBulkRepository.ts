/**
 * @file tasksBulkRepository.ts
 * @description Set-based bulk archive/restore/status operations for Tasks.
 *
 * One UPDATE per batch (instead of a per-row SELECT + UPDATE loop), one outbox
 * insert + NOTIFY, and per-row audit (the hash chain is per-record by design).
 * Rows that cannot change are returned with a reason instead of being dropped.
 */
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { isTaskStatusTransitionAllowed, type TaskStatus } from "@mms/shared";
import { tasks } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { lockFacultyHierarchy } from "./facultyAssignmentValidation.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { emitOutboxEvents, type OutboxBatchEvent } from "../../services/outboxEventService.js";
import { hasActiveChild, hasActiveParent } from "./tasksBulkPredicates.js";
import {
  classifyDeleteSkips,
  classifyRestoreSkips,
  uniqueIds,
  type TaskBulkSkip,
} from "./tasksBulkSkips.js";

export type { TaskBulkSkip, TaskBulkSkipReason } from "./tasksBulkSkips.js";

export interface TaskStatusChange {
  id: string;
  title: string;
  createdById: string | null;
  previousStatus: TaskStatus;
  status: TaskStatus;
}

export async function bulkDeleteTasksBatch(
  tenant: string,
  ids: readonly string[],
  actorUserId: string,
): Promise<{ deletedIds: string[]; skipped: TaskBulkSkip[] }> {
  const subdomain = tenant.trim().toLowerCase();
  const requested = uniqueIds(ids);
  if (requested.length === 0) return { deletedIds: [], skipped: [] };

  return withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const now = new Date();
    const deleted = await tx
      .update(tasks)
      .set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now })
      .where(
        and(
          eq(tasks.workspaceSubdomain, subdomain),
          inArray(tasks.id, requested),
          isNull(tasks.deletedAt),
          hasActiveChild(tx, subdomain),
        ),
      )
      .returning({ id: tasks.id });

    const deletedIds = deleted.map((row) => String(row.id));
    const deletedSet = new Set(deletedIds);
    const remaining = requested.filter((id) => !deletedSet.has(id));
    const skipped = remaining.length ? await classifyDeleteSkips(tx, subdomain, remaining) : [];

    for (const id of deletedIds) {
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: subdomain,
        tableName: "tasks",
        recordId: id,
        actionType: "DELETE",
        realUserId: actorUserId,
      });
    }
    await emitOutboxEvents(
      deletedIds.map((id): OutboxBatchEvent => ({
        type: "entity.soft_deleted",
        payload: {
          entityType: "tasks",
          entityId: id,
          tenantId: subdomain,
          deletedAt: now.toISOString(),
          deletedBy: actorUserId,
          version: now.getTime(),
        },
      })),
    );

    return { deletedIds, skipped };
  });
}

export async function bulkRestoreTasksBatch(
  tenant: string,
  ids: readonly string[],
  actorUserId: string,
): Promise<{ restoredIds: string[]; skipped: TaskBulkSkip[] }> {
  const subdomain = tenant.trim().toLowerCase();
  const requested = uniqueIds(ids);
  if (requested.length === 0) return { restoredIds: [], skipped: [] };

  return withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const now = new Date();
    const restored = await tx
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
        and(
          eq(tasks.workspaceSubdomain, subdomain),
          inArray(tasks.id, requested),
          isNotNull(tasks.deletedAt),
          or(isNull(tasks.parentTaskId), hasActiveParent(tx, subdomain)),
        ),
      )
      .returning({ id: tasks.id });

    const restoredIds = restored.map((row) => String(row.id));
    const restoredSet = new Set(restoredIds);
    const remaining = requested.filter((id) => !restoredSet.has(id));
    const skipped = remaining.length ? await classifyRestoreSkips(tx, subdomain, remaining) : [];

    for (const id of restoredIds) {
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: subdomain,
        tableName: "tasks",
        recordId: id,
        actionType: "RESTORE",
        realUserId: actorUserId,
      });
    }
    await emitOutboxEvents(
      restoredIds.map((id): OutboxBatchEvent => ({
        type: "entity.restored",
        payload: {
          entityType: "tasks",
          entityId: id,
          tenantId: subdomain,
          restoredAt: now.toISOString(),
          restoredBy: actorUserId,
          version: now.getTime(),
        },
      })),
    );

    return { restoredIds, skipped };
  });
}

export async function bulkUpdateTaskStatusBatch(
  tenant: string,
  ids: readonly string[],
  status: TaskStatus,
  actorUserId: string,
): Promise<{
  updatedIds: string[];
  skipped: TaskBulkSkip[];
  changes: TaskStatusChange[];
}> {
  const subdomain = tenant.trim().toLowerCase();
  const requested = uniqueIds(ids);
  if (requested.length === 0) return { updatedIds: [], skipped: [], changes: [] };

  return withTenant(subdomain, async (tx) => {
    await lockFacultyHierarchy(tx, subdomain);
    const current = await tx
      .select({
        id: tasks.id,
        title: tasks.title,
        createdById: tasks.createdBy,
        status: tasks.status,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceSubdomain, subdomain),
          inArray(tasks.id, requested),
          isNull(tasks.deletedAt),
        ),
      );
    const currentById = new Map(current.map((row) => [String(row.id), row]));

    const skipped: TaskBulkSkip[] = [];
    const allowed: typeof current = [];
    for (const id of requested) {
      const row = currentById.get(id);
      if (!row) {
        skipped.push({ id, reason: "not_found" });
        continue;
      }
      if (row.status === status) {
        skipped.push({ id, reason: "already_in_status" });
        continue;
      }
      if (!isTaskStatusTransitionAllowed(row.status as TaskStatus, status)) {
        skipped.push({ id, reason: "illegal_transition" });
        continue;
      }
      allowed.push(row);
    }
    if (allowed.length === 0) return { updatedIds: [], skipped, changes: [] };

    const now = new Date();
    const updated = await tx
      .update(tasks)
      .set({
        status,
        updatedAt: now,
        completedAt: status === "completed" ? now : null,
        cancelledAt: status === "cancelled" ? now : null,
      })
      .where(
        and(
          eq(tasks.workspaceSubdomain, subdomain),
          inArray(
            tasks.id,
            allowed.map((row) => String(row.id)),
          ),
          isNull(tasks.deletedAt),
        ),
      )
      .returning({ id: tasks.id });

    const updatedIds = updated.map((row) => String(row.id));
    const allowedById = new Map(allowed.map((row) => [String(row.id), row]));
    const changes: TaskStatusChange[] = updatedIds.map((id) => {
      const previous = allowedById.get(id)!;
      return {
        id,
        title: previous.title,
        createdById: previous.createdById ?? null,
        previousStatus: previous.status as TaskStatus,
        status,
      };
    });

    for (const change of changes) {
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: subdomain,
        tableName: "tasks",
        recordId: change.id,
        actionType: "UPDATE",
        realUserId: actorUserId,
        oldState: { status: change.previousStatus },
        newState: { status: change.status },
      });
    }

    return { updatedIds, skipped, changes };
  });
}
