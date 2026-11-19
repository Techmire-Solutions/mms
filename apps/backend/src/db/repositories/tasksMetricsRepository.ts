import { and, eq, isNull, sql } from "drizzle-orm";
import { type TaskListQuery } from "@mms/shared";
import { tasks, workspaces } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { buildTaskFilterConditions } from "./tasksFilterConditions.js";

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
    const now = new Date();
    const conditions = [eq(tasks.workspaceSubdomain, subdomain), isNull(tasks.deletedAt)];

    let timezone = "UTC";
    if (query?.dueFrom?.trim() || query?.dueTo?.trim() || query?.dueOn?.trim()) {
      const [workspace] = await tx
        .select({ timezone: workspaces.timezone })
        .from(workspaces)
        .where(eq(workspaces.subdomain, subdomain));
      timezone = workspace?.timezone?.trim() || "UTC";
    }

    conditions.push(...buildTaskFilterConditions(query, timezone));

    const [row] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        todo: sql<number>`count(*) FILTER (WHERE status = 'todo')::int`,
        inProgress: sql<number>`count(*) FILTER (WHERE status = 'in_progress')::int`,
        inReview: sql<number>`count(*) FILTER (WHERE status = 'in_review')::int`,
        blocked: sql<number>`count(*) FILTER (WHERE status = 'blocked')::int`,
        completed: sql<number>`count(*) FILTER (WHERE status = 'completed')::int`,
        cancelled: sql<number>`count(*) FILTER (WHERE status = 'cancelled')::int`,
        overdue: sql<number>`count(*) FILTER (WHERE ${tasks.dueAt} < ${now} AND ${tasks.status} NOT IN ('completed', 'cancelled'))::int`,
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
