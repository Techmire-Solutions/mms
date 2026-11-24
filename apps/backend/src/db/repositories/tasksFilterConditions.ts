import { and, eq, gte, ilike, inArray, lt, lte, notInArray, or, type SQL } from "drizzle-orm";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  toSqlSearchPattern,
  type TaskListQuery,
  type TaskPriority,
  type TaskStatus,
} from "@mms/contracts";
import { tasks } from "@mms/db/schema";
import { isIsoDateOnly, nextIsoDay, workspaceDayStartUtc } from "../../lib/workspaceDayBounds.js";

function splitEnum<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is T => (allowed as readonly string[]).includes(value));
}

/**
 * Shared directory filter conditions for the Work list and the metrics
 * aggregate (m7/B5). Workspace-subdomain and soft-delete predicates stay with
 * each caller; the assignee subquery and the timezone lookup stay in `listTasks`.
 */
export function buildTaskFilterConditions(
  query: TaskListQuery | undefined,
  timezone: string,
): SQL[] {
  const conditions: SQL[] = [];

  if (query?.status) conditions.push(eq(tasks.status, query.status));
  if (query?.priority) conditions.push(eq(tasks.priority, query.priority));
  if (query?.createdById) conditions.push(eq(tasks.createdByUserId, query.createdById));

  if (query?.dueFrom?.trim()) {
    const fromStr = query.dueFrom.trim();
    const fromDate = fromStr.includes("T")
      ? new Date(fromStr)
      : workspaceDayStartUtc(fromStr, timezone);
    if (!isNaN(fromDate.getTime())) conditions.push(gte(tasks.dueAt, fromDate));
  }
  if (query?.dueTo?.trim()) {
    const toStr = query.dueTo.trim();
    if (toStr.includes("T")) {
      const toDate = new Date(toStr);
      if (!isNaN(toDate.getTime())) conditions.push(lte(tasks.dueAt, toDate));
    } else if (isIsoDateOnly(toStr)) {
      conditions.push(lt(tasks.dueAt, workspaceDayStartUtc(nextIsoDay(toStr), timezone)));
    }
  }
  const statuses = splitEnum<TaskStatus>(query?.statuses, TASK_STATUSES);
  if (statuses.length > 0) conditions.push(inArray(tasks.status, statuses));
  const priorities = splitEnum<TaskPriority>(query?.priorities, TASK_PRIORITIES);
  if (priorities.length > 0) conditions.push(inArray(tasks.priority, priorities));
  const ids = (query?.ids ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 500);
  if (ids.length > 0) conditions.push(inArray(tasks.id, ids));
  if (query?.overdue) {
    conditions.push(
      and(lt(tasks.dueAt, new Date()), notInArray(tasks.status, ["completed", "cancelled"]))!,
    );
  }
  if (query?.dueOn?.trim() && isIsoDateOnly(query.dueOn.trim())) {
    const day = query.dueOn.trim();
    conditions.push(
      and(
        gte(tasks.dueAt, workspaceDayStartUtc(day, timezone)),
        lt(tasks.dueAt, workspaceDayStartUtc(nextIsoDay(day), timezone)),
      )!,
    );
  }
  if (query?.search) {
    const term = toSqlSearchPattern(query.search);
    conditions.push(or(ilike(tasks.title, term), ilike(tasks.description, term))!);
  }

  return conditions;
}
