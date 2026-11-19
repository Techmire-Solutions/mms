import type { TaskInsert, TaskStatus, TaskUpdate } from "@mms/shared";
import { withTenant } from "../db/tenant-context.js";
import { lockFacultyHierarchy } from "../db/repositories/facultyAssignmentValidation.js";
import {
  bulkUpdateTaskStatus,
  createTask,
  findTaskById,
  updateTask,
} from "../tasks/use-cases/tasksUseCases.js";
import { validateTaskDelegation } from "./taskDelegationService.js";
import { getTenantTaskSettings } from "./taskSettingsService.js";
import {
  emitTaskBulkStatusNotifications,
  emitTaskNotificationIntents,
} from "./taskNotificationService.js";
import { canActorMutateTask } from "./taskOwnership.js";
import { broadcastTenantUpdate } from "../lib/livePush.js";
import { HttpDomainError } from "../lib/httpErrors.js";

/** Delegation eligibility failure → 403 via the shared Tasks error mapper. */
export class TaskDelegationError extends HttpDomainError {
  constructor(message = "Recipient is not eligible for this assignment") {
    super(403, "forbidden", message);
    this.name = "TaskDelegationError";
  }
}

export async function mutateTask(
  tenant: string,
  actorId: string,
  canAssignAnywhere: boolean,
  mutation:
    | { kind: "create"; data: TaskInsert }
    | { kind: "update"; id: string; data: TaskUpdate; expectedUpdatedAt?: string },
) {
  const previous = mutation.kind === "update" ? await findTaskById(tenant, mutation.id) : null;

  return withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    const settings = await getTenantTaskSettings();
    const delegation = await validateTaskDelegation(
      tenant,
      actorId,
      mutation.data.assignees ?? [],
      { ...settings, canAssignAnywhere },
    );
    if (!delegation.valid) throw new TaskDelegationError(delegation.reason);

    let next;
    if (mutation.kind === "create") {
      next = await createTask(tenant, mutation.data, delegation.resolvedAssignees, actorId);
    } else {
      // Scoped ownership (M2): creator, assignee, or assign_anywhere holder only.
      if (!canActorMutateTask(previous, actorId, canAssignAnywhere)) {
        throw new TaskDelegationError("You do not have permission to modify this task");
      }
      // Assignee-removal guard (M2): an empty/shrunken set must not strip people
      // without assign_anywhere. The delegation pass short-circuits on empty input.
      if (mutation.data.assignees !== undefined) {
        const nextIds = new Set(delegation.resolvedAssignees.map((a) => a.userId));
        const removed = (previous?.assignees ?? []).filter((a) => !nextIds.has(a.userId));
        if (removed.length > 0 && !canAssignAnywhere) {
          throw new TaskDelegationError("Removing assignees requires assign-anywhere permission");
        }
      }
      next = await updateTask(
        tenant,
        mutation.id,
        mutation.data,
        mutation.data.assignees === undefined ? undefined : delegation.resolvedAssignees,
        actorId,
        mutation.expectedUpdatedAt,
      );
    }

    // Atomic outbox (A5): the notification intent commits with the mutation.
    if (next) {
      await emitTaskNotificationIntents(tx, {
        tenant,
        settings,
        actorUserId: actorId,
        previous,
        next,
      });
    }
    broadcastTenantUpdate(tenant, "collection", "tasks");
    return next;
  });
}

/**
 * Status-change use case (A6): ownership + transition + atomic outbox in one
 * transaction, so non-HTTP callers get the same notification behaviour as the
 * UI.
 */
export async function changeTaskStatus(
  tenant: string,
  actorId: string,
  canAssignAnywhere: boolean,
  id: string,
  status: TaskStatus,
  forceCompleteSubtasks: boolean,
  expectedUpdatedAt?: string,
) {
  const previous = await findTaskById(tenant, id);
  return withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    if (!canActorMutateTask(previous, actorId, canAssignAnywhere)) {
      throw new TaskDelegationError("You do not have permission to modify this task");
    }
    const settings = await getTenantTaskSettings();
    const next = await updateTask(
      tenant,
      id,
      { status, forceCompleteSubtasks },
      undefined,
      actorId,
      expectedUpdatedAt,
    );
    if (next) {
      await emitTaskNotificationIntents(tx, {
        tenant,
        settings,
        actorUserId: actorId,
        previous,
        next,
      });
    }
    broadcastTenantUpdate(tenant, "collection", "tasks");
    return next;
  });
}

/**
 * Bulk status-change use case (A6): one transaction for the batched UPDATE and
 * its outbox intents.
 */
export async function changeTasksBulkStatus(
  tenant: string,
  actorId: string,
  canAssignAnywhere: boolean,
  ids: string[],
  status: TaskStatus,
) {
  return withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    const settings = await getTenantTaskSettings();
    const result = await bulkUpdateTaskStatus(tenant, ids, status, actorId, canAssignAnywhere);
    if (result.changes.length > 0) {
      await emitTaskBulkStatusNotifications(tx, {
        tenant,
        settings,
        actorUserId: actorId,
        changes: result.changes,
      });
    }
    broadcastTenantUpdate(tenant, "collection", "tasks");
    return result;
  });
}
