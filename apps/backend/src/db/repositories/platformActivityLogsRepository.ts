import { asc, desc, gte, inArray, lt, sql } from "drizzle-orm";
import { activeDb } from "../dbConnection.js";
import { platformActivityLogs, workspaces } from "../schema.js";
import { logger } from "../../lib/logger.js";

export interface InsertPlatformActivityLog {
  userId?: string | null;
  userEmail: string;
  action: string;
  targetResource?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  metadataMessage?: string | null;
}

export async function insertPlatformActivityLog(log: InsertPlatformActivityLog): Promise<void> {
  try {
    await activeDb()
      .insert(platformActivityLogs)
      .values({
        userId: log.userId ?? null,
        userEmail: log.userEmail,
        action: log.action,
        targetResource: log.targetResource || null,
        targetId: log.targetId || null,
        ipAddress: log.ipAddress || null,
        metadataMessage: log.metadataMessage || null,
      });
  } catch (error) {
    try {
      await activeDb()
        .insert(platformActivityLogs)
        .values({
          userId: null,
          userEmail: log.userEmail,
          action: log.action,
          targetResource: log.targetResource || null,
          targetId: log.targetId || null,
          ipAddress: log.ipAddress || null,
          metadataMessage: log.metadataMessage || null,
        });
    } catch (innerError) {
      logger.warn({ err: innerError }, "Failed to insert activity log");
    }
  }
}

/** Count apex activity-log rows older than `cutoff` (for dry-run purge). */
export async function countPlatformActivityLogsOlderThan(cutoff: Date): Promise<number> {
  const rows = await activeDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(platformActivityLogs)
    .where(lt(platformActivityLogs.createdAt, cutoff));
  return Number(rows[0]?.count) || 0;
}

/**
 * Hard-deletes up to `limit` oldest platform activity logs with `created_at` before
 * `cutoff`. Apex table — no RLS / soft-delete. Returns the number of rows deleted.
 */
export async function deletePlatformActivityLogsOlderThan(
  cutoff: Date,
  limit = 500,
): Promise<number> {
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const candidates = await activeDb()
    .select({ id: platformActivityLogs.id })
    .from(platformActivityLogs)
    .where(lt(platformActivityLogs.createdAt, cutoff))
    .orderBy(asc(platformActivityLogs.createdAt))
    .limit(safeLimit);

  if (candidates.length === 0) return 0;

  const ids = candidates.map((row) => row.id);
  await activeDb().delete(platformActivityLogs).where(inArray(platformActivityLogs.id, ids));
  return ids.length;
}

export async function listPlatformActivityLogs(limit = 50, offset = 0) {
  const safeLimit = Math.min(Math.max(1, limit), 200);
  const safeOffset = Math.max(0, offset);
  const rows = await activeDb()
    .select({
      id: platformActivityLogs.id,
      userId: platformActivityLogs.userId,
      userEmail: platformActivityLogs.userEmail,
      action: platformActivityLogs.action,
      targetResource: platformActivityLogs.targetResource,
      targetId: platformActivityLogs.targetId,
      ipAddress: platformActivityLogs.ipAddress,
      metadataMessage: platformActivityLogs.metadataMessage,
      createdAt: platformActivityLogs.createdAt,
    })
    .from(platformActivityLogs)
    .orderBy(desc(platformActivityLogs.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userEmail: row.userEmail,
    action: row.action,
    targetResource: row.targetResource,
    targetId: row.targetId,
    ipAddress: row.ipAddress,
    metadataMessage: row.metadataMessage,
    createdAt: row.createdAt.toISOString(),
  }));
}

export interface MonthlyPlatformActivityItem {
  month: string;
  yearMonth: string;
  tenants: number;
  ops: number;
}

export async function getPlatformMonthlyActivityTrend(
  monthsCount = 6,
): Promise<MonthlyPlatformActivityItem[]> {
  const safeMonths = Math.min(Math.max(1, monthsCount), 24);
  const now = new Date();
  const monthBuckets: { yearMonth: string; label: string; start: Date; end: Date }[] = [];

  for (let i = safeMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short" });
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    monthBuckets.push({ yearMonth, label, start, end });
  }

  const oldestDate = monthBuckets[0]?.start ?? new Date(now.getFullYear(), now.getMonth() - 5, 1);

  try {
    const logRows = await activeDb()
      .select({
        yearMonth: sql<string>`to_char(${platformActivityLogs.createdAt}, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(platformActivityLogs)
      .where(gte(platformActivityLogs.createdAt, oldestDate))
      .groupBy(sql`to_char(${platformActivityLogs.createdAt}, 'YYYY-MM')`);

    const opsMap = new Map<string, number>();
    for (const r of logRows) {
      if (r.yearMonth) {
        opsMap.set(r.yearMonth, Number(r.count) || 0);
      }
    }

    const wsRows = await activeDb()
      .select({
        createdAt: workspaces.createdAt,
        enabled: workspaces.enabled,
      })
      .from(workspaces);

    const enabledWsTimestamps: number[] = [];
    for (let i = 0; i < wsRows.length; i++) {
      if (wsRows[i].enabled && wsRows[i].createdAt) {
        enabledWsTimestamps.push(wsRows[i].createdAt.getTime());
      }
    }
    enabledWsTimestamps.sort((a, b) => a - b);

    let wsIndex = 0;
    const wsLen = enabledWsTimestamps.length;

    return monthBuckets.map((bucket) => {
      const ops = opsMap.get(bucket.yearMonth) ?? 0;
      const endTime = bucket.end.getTime();
      while (wsIndex < wsLen && enabledWsTimestamps[wsIndex] <= endTime) {
        wsIndex++;
      }

      return {
        month: bucket.label,
        yearMonth: bucket.yearMonth,
        tenants: wsIndex,
        ops,
      };
    });
  } catch (error) {
    logger.warn({ err: error }, "Failed to compute activity trend");
    return monthBuckets.map((bucket) => ({
      month: bucket.label,
      yearMonth: bucket.yearMonth,
      tenants: 0,
      ops: 0,
    }));
  }
}
