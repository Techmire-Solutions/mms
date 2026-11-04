/**
 * @file taskImportUseCases.ts
 * @description Queued CSV import for Tasks — one task per validated row.
 */
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskAssigneeInput,
  type TaskInsert,
  type TasksImportBody,
} from "@mms/shared";
import { tenantUserHasPermission } from "../../lib/tenantRoleCatalog.js";
import { getTenantTaskSettings } from "../../services/taskSettingsService.js";
import { getEligibleTaskAssignees } from "../../services/taskEligibleAssigneesService.js";
import { mutateTask } from "../../services/taskMutationService.js";

type TaskImportRow = TasksImportBody["rows"][number];

export interface TaskImportJobContext {
  tenant: string;
  userId: string;
  viewerRole: string;
  updateProgress: (current: number, total: number) => Promise<void>;
}

export interface TaskImportJobResult {
  imported: number;
  failed: number;
  total: number;
  errors: Array<{ row: number; reason: string }>;
}

const MAX_RECORDED_FAILURES = 5;

function coerceEnum<T extends string>(
  values: readonly T[],
  raw: string | undefined,
  fallback: T,
): T {
  const key = (raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return (values as readonly string[]).includes(key) ? (key as T) : fallback;
}

/** ISO date → end-of-day UTC; full timestamps are preserved. */
function parseDueAt(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const ms = Date.parse(dateOnly ? `${value}T23:59:59.999Z` : value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function buildAssigneeInputs(
  raw: string,
  eligible: Awaited<ReturnType<typeof getEligibleTaskAssignees>>,
): TaskAssigneeInput[] {
  const needle = raw.trim().toLowerCase();
  const match = eligible.find((recipient) =>
    [recipient.employeeId, recipient.name, recipient.userId]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.trim().toLowerCase() === needle),
  );
  if (!match) throw new Error(`Assignee not found: ${raw}`);
  return [
    {
      facultyId: match.facultyId,
      userId: match.userId,
      ...(match.assignmentId ? { facultyAssignmentId: match.assignmentId } : {}),
    },
  ];
}

/**
 * Creates one task per row through the same mutation service the UI uses, so
 * delegation eligibility, audit and notifications are identical to a manual
 * create. A bad row fails alone; valid rows still import.
 */
export async function runTasksImportJob(
  rows: TaskImportRow[],
  context: TaskImportJobContext,
): Promise<TaskImportJobResult> {
  const total = rows.length;
  const settings = await getTenantTaskSettings();
  const canAssign = await tenantUserHasPermission(context.tenant, context.userId, "tasks.assign");
  const canAssignAnywhere = await tenantUserHasPermission(
    context.tenant,
    context.userId,
    "tasks.assign_anywhere",
  );
  const eligible = await getEligibleTaskAssignees(context.tenant, context.userId, {
    ...settings,
    canAssignAnywhere,
  });

  const errors: Array<{ row: number; reason: string }> = [];
  let imported = 0;
  await context.updateProgress(0, Math.max(total, 1));

  for (let i = 0; i < total; i += 1) {
    const row = rows[i];
    try {
      const title = row.title?.trim();
      if (!title) throw new Error("Title is required");

      const assigneeRaw = row.assignee?.trim();
      let assignees: TaskAssigneeInput[] = [];
      if (assigneeRaw) {
        if (!canAssign) throw new Error("Assignment permission required");
        assignees = buildAssigneeInputs(assigneeRaw, eligible);
      }

      const description = [row.description?.trim(), row.notes?.trim()]
        .filter((part): part is string => Boolean(part))
        .join("\n\n");

      const data: TaskInsert = {
        title,
        description: description || undefined,
        status: coerceEnum(TASK_STATUSES, row.status, "todo"),
        priority: coerceEnum(TASK_PRIORITIES, row.priority, "medium"),
        startDate: null,
        dueAt: parseDueAt(row.dueDate),
        parentTaskId: null,
        assignees,
      };

      await mutateTask(context.tenant, context.userId, canAssignAnywhere, {
        kind: "create",
        data,
      });
      imported += 1;
    } catch (error: unknown) {
      if (errors.length < MAX_RECORDED_FAILURES) {
        errors.push({
          row: i + 1,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if ((i + 1) % 10 === 0 || i + 1 === total) {
      await context.updateProgress(i + 1, Math.max(total, 1));
    }
  }

  return { imported, failed: total - imported, total, errors };
}
