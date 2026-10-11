import { and, eq, isNull, sql } from "drizzle-orm";
import { tasks } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

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

export async function getTaskMetrics(tenant: string): Promise<TaskMetricsRow> {
  return withTenantRead(tenant, async (tx) => {
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
      .where(and(eq(tasks.workspaceSubdomain, tenant), isNull(tasks.deletedAt)));

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
