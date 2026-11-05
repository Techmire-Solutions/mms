import type { TaskInsert, TaskPriority, TaskRecord, TaskStatus } from "@mms/shared";

export interface TaskFormPayloadInput {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: string | null;
  dueAt: string | null;
  parentTaskId: string | null;
  assignees: ReadonlyArray<{ facultyId: string }>;
  initialData?: TaskRecord | null;
}

/** Start-of-day `startDate` must not be after the `dueAt` instant. */
export function validateTaskDates(
  startDate: string | null,
  dueAt: string | null,
): "tasks.dueBeforeStart" | null {
  if (!startDate || !dueAt) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const due = new Date(dueAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) return null;
  return start.getTime() > due.getTime() ? "tasks.dueBeforeStart" : null;
}

/** True when the picker differs from the loaded record (always true on create). */
export function assigneesChanged(input: TaskFormPayloadInput): boolean {
  if (!input.initialData) return true;
  const normalize = (ids: ReadonlyArray<string>) =>
    [...ids]
      .map((id) => id.trim())
      .sort()
      .join(",");
  return (
    normalize((input.initialData.assignees ?? []).map((a) => a.facultyId)) !==
    normalize(input.assignees.map((a) => a.facultyId))
  );
}

/**
 * Builds the task write payload.
 *
 * On an update whose assignee set is unchanged the array is **omitted**:
 * the server treats `assignees !== undefined` as an assignment mutation and
 * re-runs delegation validation, so resubmitting the unchanged set 403s a
 * non-admin editor on another user's task. An omitted array means "leave the
 * current assignees alone" (`tasksWriteRepository`).
 */
export function buildTaskFormPayload(input: TaskFormPayloadInput): TaskInsert {
  const base = {
    title: input.title.trim(),
    description: input.description.trim() || undefined,
    priority: input.priority,
    status: input.status,
    startDate: input.startDate || null,
    dueAt: input.dueAt || null,
    parentTaskId: input.parentTaskId || null,
  };

  if (!assigneesChanged(input)) {
    // Deliberate: `TaskUpdate` accepts a partial body; the cast keeps the
    // public form callback typed as `TaskInsert` (create always sends the set).
    return base as TaskInsert;
  }

  return {
    ...base,
    assignees: input.assignees.map((a) => ({ facultyId: a.facultyId })),
  };
}
