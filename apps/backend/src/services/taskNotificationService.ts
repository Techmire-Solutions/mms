/**
 * @file taskNotificationService.ts
 * @description Emits task notification intents via transactional outbox when Setup prefs allow.
 * Delivery to SMS/WhatsApp/email is owned by messaging consumers of these events.
 */

import type { TaskRecord, TaskSettings, TaskStatus } from "@mms/shared";
import { withTenant } from "../db/tenant-context.js";
import { emitOutboxEvent, emitOutboxEvents, type OutboxBatchEvent } from "./outboxEventService.js";

export async function emitTaskNotificationIntents(input: {
  tenant: string;
  settings: TaskSettings;
  actorUserId: string;
  previous: TaskRecord | null;
  next: TaskRecord;
}): Promise<void> {
  const { tenant, settings, actorUserId, previous, next } = input;
  const assigneeIds = [
    ...new Set(
      (next.assignees ?? []).map((a) => a.userId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const previousAssigneeIds = new Set(
    (previous?.assignees ?? []).map((a) => a.userId).filter((id): id is string => Boolean(id)),
  );
  const newAssigneeIds = assigneeIds.filter((id) => !previousAssigneeIds.has(id));
  const statusChanged = Boolean(previous && previous.status !== next.status);
  const creatorId = next.createdById ?? null;

  const shouldNotifyAssignment = settings.notifyOnAssignment && newAssigneeIds.length > 0;
  const shouldNotifyStatus =
    settings.notifyOnStatusChange && statusChanged && creatorId && creatorId !== actorUserId;

  if (!shouldNotifyAssignment && !shouldNotifyStatus) return;

  await withTenant(tenant, async (tx) => {
    if (shouldNotifyAssignment) {
      await emitOutboxEvent(tx, "task.assigned", {
        entityType: "tasks",
        entityId: next.id,
        tenantId: tenant,
        version: Date.now(),
        recipientUserIds: newAssigneeIds,
        actorUserId,
        reason: "assignment",
        status: next.status,
        title: next.title,
      });
    }
    if (shouldNotifyStatus && creatorId) {
      await emitOutboxEvent(tx, "task.status_changed", {
        entityType: "tasks",
        entityId: next.id,
        tenantId: tenant,
        version: Date.now(),
        recipientUserIds: [creatorId],
        actorUserId,
        reason: "status_change",
        status: next.status,
        title: next.title,
      });
    }
  });
}

export interface TaskBulkStatusNotificationChange {
  id: string;
  title: string;
  createdById: string | null;
  status: TaskStatus;
}

/**
 * Batched creator notification for a bulk status change: one transaction, one
 * outbox insert + NOTIFY for the whole batch (single-task parity).
 */
export async function emitTaskBulkStatusNotifications(input: {
  tenant: string;
  settings: TaskSettings;
  actorUserId: string;
  changes: readonly TaskBulkStatusNotificationChange[];
}): Promise<void> {
  const { tenant, settings, actorUserId, changes } = input;
  if (!settings.notifyOnStatusChange || changes.length === 0) return;

  const events: OutboxBatchEvent[] = changes
    .filter((change) => change.createdById && change.createdById !== actorUserId)
    .map((change) => ({
      type: "task.status_changed",
      payload: {
        entityType: "tasks",
        entityId: change.id,
        tenantId: tenant,
        version: Date.now(),
        recipientUserIds: [change.createdById as string],
        actorUserId,
        reason: "status_change",
        status: change.status,
        title: change.title,
      },
    }));
  if (events.length === 0) return;

  await withTenant(tenant, async () => {
    await emitOutboxEvents(events);
  });
}
