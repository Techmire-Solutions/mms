import { and, eq, gte, ilike, inArray, isNull, lt, lte, notInArray, or, sql } from "drizzle-orm";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  toSqlSearchPattern,
  type TaskListQuery,
  type TaskPriority,
  type TaskStatus,
} from "@mms/shared";
import { tasks, workspaces } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { isIsoDateOnly, nextIsoDay, workspaceDayStartUtc } from "../../lib/workspaceDayBounds.js";

export interface TaskMetricsRow {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  blocked: number;
  completed: number;
  cancelled: number;
  overdue: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
}

function splitEnum<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is T => (allowed as readonly string[]).includes(value));
}

/**
 * Workspace task metrics, optionally narrowed by the same directory filters the
 * Work tab applies (m7). When no filters are supplied the result is the
 * workspace-wide command-centre KPI strip.
 */
export async function getTaskMetrics(
  tenant: string,
  query?: TaskListQuery,
): Promise<TaskMetricsRow> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [eq(tasks.workspaceSubdomain, subdomain), isNull(tasks.deletedAt)];

    if (query?.status) conditions.push(eq(tasks.status, query.status));
    if (query?.priority) conditions.push(eq(tasks.priority, query.priority));
    if (query?.createdById) conditions.push(eq(tasks.createdByUserId, query.createdById));

    const [workspace] = await tx
      .select({ timezone: workspaces.timezone })
      .from(workspaces)
      .where(eq(workspaces.subdomain, subdomain));
    const timezone = workspace?.timezone?.trim() || "UTC";

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

    const [row] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        todo: sql<number>`count(*) FILTER (WHERE status = 'todo')::int`,
        inProgress: sql<number>`count(*) FILTER (WHERE status = 'in_progress')::int`,
        inReview: sql<number>`count(*) FILTER (WHERE status = 'in_review')::int`,
        blocked: sql<number>`count(*) FILTER (WHERE status = 'blocked')::int`,
        completed: sql<number>`count(*) FILTER (WHERE status = 'completed')::int`,
        cancelled: sql<number>`count(*) FILTER (WHERE status = 'cancelled')::int`,
        overdue: sql<number>`count(*) FILTER (WHERE due_at < CURRENT_TIMESTAMP
        AND status NOT IN ('completed', 'cancelled'))::int`,
        priorityLow: sql<number>`count(*) FILTER (WHERE priority = 'low')::int`,
        priorityMedium: sql<number>`count(*) FILTER (WHERE priority = 'medium')::int`,
        priorityHigh: sql<number>`count(*) FILTER (WHERE priority = 'high')::int`,
        priorityUrgent: sql<number>`count(*) FILTER (WHERE priority = 'urgent')::int`,
      })
      .from(tasks)
      .where(and(...conditions));

    return {
      total: row?.total ?? 0,
      todo: row?.todo ?? 0,
      inProgress: row?.inProgress ?? 0,
      inReview: row?.inReview ?? 0,
      blocked: row?.blocked ?? 0,
      completed: row?.completed ?? 0,
      cancelled: row?.cancelled ?? 0,
      overdue: row?.overdue ?? 0,
      byPriority: {
        low: row?.priorityLow ?? 0,
        medium: row?.priorityMedium ?? 0,
        high: row?.priorityHigh ?? 0,
        urgent: row?.priorityUrgent ?? 0,
      },
    };
  });
}
