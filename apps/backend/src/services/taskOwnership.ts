import type { TaskRecord } from "@mms/shared";

/**
 * A task may be mutated/archived by its creator, one of its assignees, or a
 * caller holding `tasks.assign_anywhere`. Returns false for a missing task.
 */
export function canActorMutateTask(
  task: TaskRecord | null,
  actorUserId: string | undefined,
  canAssignAnywhere: boolean,
): boolean {
  if (!task) return false;
  if (canAssignAnywhere) return true;
  if (!actorUserId) return false;
  if (task.createdById === actorUserId) return true;
  return (task.assignees ?? []).some((assignee) => assignee.userId === actorUserId);
}
