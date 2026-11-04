/**
 * @file tasksExportService.ts
 * @description CSV export for the Tasks module (streamed + buffered).
 *
 * The Work directory paginates with OFFSET; this exporter walks every page so a
 * tasks export is complete rather than silently truncated to the first page.
 */
import {
  buildCsvContent,
  buildTenantExportFilename,
  type TaskListQuery,
  type TaskRecord,
  type TaskPriority,
  type TaskStatus,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { listTasks } from "../tasks/use-cases/tasksUseCases.js";

export interface TasksExportOptions {
  columns?: unknown;
  filename?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface TasksCsvExportResult {
  csv: string;
  filename: string;
  count: number;
}

const PAGE_SIZE = 250;

const TASK_EXPORT_COLUMNS = [
  "Task Title",
  "Assigned User",
  "Priority",
  "Status",
  "Due Date",
  "Description",
  "Notes / Comments",
] as const;

function requireTenant(): string {
  const tenant = getRequestTenant()?.trim().toLowerCase();
  if (!tenant) throw new Error("Tenant context required for tasks export");
  return tenant;
}

function resolveFilename(tenant: string, raw: string | undefined): string {
  const base = raw?.trim() || "tasks.csv";
  const withExt = base.toLowerCase().endsWith(".csv") ? base : `${base}.csv`;
  return buildTenantExportFilename(tenant, withExt);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toListQuery(query: Record<string, unknown>, allowDeleted: boolean): TaskListQuery {
  return {
    status: readString(query.status) as TaskStatus | undefined,
    priority: readString(query.priority) as TaskPriority | undefined,
    assignedToFacultyId: readString(query.assignedToFacultyId),
    assignedToUserId: readString(query.assignedToUserId),
    createdById: readString(query.createdById),
    search: readString(query.search),
    dueFrom: readString(query.dueFrom),
    dueTo: readString(query.dueTo),
    overdue: false,
    includeDeleted: allowDeleted && query.includeDeleted === true,
    limit: PAGE_SIZE,
    offset: 0,
  };
}

async function loadExportPage(
  tenant: string,
  query: TaskListQuery,
  page: number,
): Promise<{ rows: TaskRecord[]; hasMore: boolean }> {
  const offset = (page - 1) * PAGE_SIZE;
  const result = await listTasks(tenant, { ...query, offset });
  return { rows: result.tasks, hasMore: offset + result.tasks.length < result.total };
}

function taskToRow(task: TaskRecord): string[] {
  const assignees = (task.assignees ?? [])
    .map((assignee) => assignee.facultyName ?? assignee.userEmail ?? assignee.userId)
    .filter(Boolean)
    .join("; ");
  return [
    task.title,
    assignees,
    task.priority,
    task.status,
    task.dueAt ? String(task.dueAt).slice(0, 10) : "",
    task.description ?? "",
    "",
  ];
}

/** Buffered CSV export (worker fallback when streaming is unavailable). */
export async function buildTasksCsvExport(
  query: Record<string, unknown>,
  options: TasksExportOptions,
): Promise<TasksCsvExportResult> {
  const tenant = requireTenant();
  const filename = resolveFilename(tenant, options.filename);
  const listQuery = toListQuery(query, options.allowDeleted === true);
  const rows: string[][] = [TASK_EXPORT_COLUMNS.slice()];

  let count = 0;
  for (let page = 1; ; page += 1) {
    const result = await loadExportPage(tenant, listQuery, page);
    rows.push(...result.rows.map(taskToRow));
    count += result.rows.length;
    if (!result.hasMore) break;
  }

  return { csv: buildCsvContent(rows), filename, count };
}

/** Streaming CSV export used by the queued job (constant memory per chunk). */
export async function* generateTasksCsvStreamChunks(
  query: Record<string, unknown>,
  options: TasksExportOptions,
): AsyncGenerator<string, { count: number; filename: string }, undefined> {
  const tenant = requireTenant();
  const filename = resolveFilename(tenant, options.filename);
  const listQuery = toListQuery(query, options.allowDeleted === true);

  yield buildCsvContent([TASK_EXPORT_COLUMNS.slice()]);
  let count = 0;
  for (let page = 1; ; page += 1) {
    const result = await loadExportPage(tenant, listQuery, page);
    if (result.rows.length > 0) {
      yield "\n" + buildCsvContent(result.rows.map(taskToRow));
      count += result.rows.length;
    }
    if (!result.hasMore) break;
  }
  return { count, filename };
}
