import type { TaskInsert, TaskUpdate } from "@mms/shared";
import { withTenant } from "../db/tenant-context.js";
import { lockFacultyHierarchy } from "../db/repositories/facultyAssignmentValidation.js";
import { createTask, findTaskById, updateTask } from "../tasks/use-cases/tasksUseCases.js";
import { validateTaskDelegation } from "./taskDelegationService.js";
import { getTenantTaskSettings } from "./taskSettingsService.js";
import { emitTaskNotificationIntents } from "./taskNotificationService.js";
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
      mutation.expectedUpdatedAt,
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
