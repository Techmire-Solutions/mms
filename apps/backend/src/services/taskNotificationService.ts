/**
 * @file taskNotificationService.ts
 * @description Emits task notification intents via transactional outbox when Setup prefs allow.
 * Delivery to SMS/WhatsApp/email is owned by messaging consumers of these events.
 */

import type { TaskRecord, TaskSettings } from "@mms/shared";
import { withTenant } from "../db/tenant-context.js";
import { emitOutboxEvent } from "./outboxEventService.js";

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
