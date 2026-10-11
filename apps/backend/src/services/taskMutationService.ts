import type { TaskInsert, TaskUpdate } from "@mms/shared";
import { withTenant } from "../db/tenant-context.js";
import { lockFacultyHierarchy } from "../db/repositories/facultyAssignmentValidation.js";
import { createTask, findTaskById, updateTask } from "../db/repositories/tasksRepository.js";
import { validateTaskDelegation } from "./taskDelegationService.js";
import { getTenantTaskSettings } from "./taskSettingsService.js";
import { emitTaskNotificationIntents } from "./taskNotificationService.js";

export class TaskDelegationError extends Error {}

export async function mutateTask(
  tenant: string,
  actorId: string,
  canAssignAnywhere: boolean,
  mutation: { kind: "create"; data: TaskInsert } | { kind: "update"; id: string; data: TaskUpdate },
) {
  const previous = mutation.kind === "update" ? await findTaskById(tenant, mutation.id) : null;

  const next = await withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    const settings = await getTenantTaskSettings();
    const delegation = await validateTaskDelegation(
      tenant,
      actorId,
      mutation.data.assignees ?? [],
      { ...settings, canAssignAnywhere },
    );
    if (!delegation.valid) throw new TaskDelegationError(delegation.reason);
    if (mutation.kind === "create") {
      return createTask(tenant, mutation.data, delegation.resolvedAssignees, actorId);
    }
    return updateTask(
      tenant,
      mutation.id,
      mutation.data,
      mutation.data.assignees === undefined ? undefined : delegation.resolvedAssignees,
      actorId,
    );
  });

  if (next) {
    const settings = await getTenantTaskSettings();
    await emitTaskNotificationIntents({
      tenant,
      settings,
      actorUserId: actorId,
      previous,
      next,
    });
  }
  return next;
}
