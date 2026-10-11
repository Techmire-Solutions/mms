import { and, eq, inArray, desc, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type ActivityLog, type RepositoryListOptions } from "@mms/shared";
import { userActivityLogs } from "../schema.js";
import { withTenant } from "../tenant-context.js";

type ActivityLogRow = typeof userActivityLogs.$inferSelect;

function activityLogRowToRecord(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    userId: row.userId,
    action: row.action as ActivityLog["action"],
    module: row.module,
    detail: row.detail,
    ts: row.ts,
    ip: row.ip,
  };
}

export type ListLogsOptions = RepositoryListOptions;

export async function listActivityLogsByWorkspace(
  tenant: string,
  options?: ListLogsOptions,
): Promise<ActivityLog[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(1, options?.limit ?? 100), 500);
  const offset = Math.max(0, options?.offset ?? 0);
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: userActivityLogs.id,
        workspaceSubdomain: userActivityLogs.workspaceSubdomain,
        userId: userActivityLogs.userId,
        action: userActivityLogs.action,
        module: userActivityLogs.module,
        detail: userActivityLogs.detail,
        ts: userActivityLogs.ts,
        ip: userActivityLogs.ip,
      })
      .from(userActivityLogs)
      .where(eq(userActivityLogs.workspaceSubdomain, subdomain))
      .orderBy(desc(userActivityLogs.ts))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => activityLogRowToRecord(r as ActivityLogRow));
  });
}

export async function findActivityLogById(tenant: string, id: string): Promise<ActivityLog | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: userActivityLogs.id,
        workspaceSubdomain: userActivityLogs.workspaceSubdomain,
        userId: userActivityLogs.userId,
        action: userActivityLogs.action,
        module: userActivityLogs.module,
        detail: userActivityLogs.detail,
        ts: userActivityLogs.ts,
        ip: userActivityLogs.ip,
      })
      .from(userActivityLogs)
      .where(
        and(eq(userActivityLogs.workspaceSubdomain, subdomain), eq(userActivityLogs.id, cleanId)),
      )
      .limit(1);
    const row = rows[0];
    return row ? activityLogRowToRecord(row as ActivityLogRow) : null;
  });
}

export async function findActivityLogsByIds(tenant: string, ids: string[]): Promise<ActivityLog[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: userActivityLogs.id,
        workspaceSubdomain: userActivityLogs.workspaceSubdomain,
        userId: userActivityLogs.userId,
        action: userActivityLogs.action,
        module: userActivityLogs.module,
        detail: userActivityLogs.detail,
        ts: userActivityLogs.ts,
        ip: userActivityLogs.ip,
      })
      .from(userActivityLogs)
      .where(
        and(
          eq(userActivityLogs.workspaceSubdomain, subdomain),
          inArray(userActivityLogs.id, cleanIds),
        ),
      );
    return rows.map((r) => activityLogRowToRecord(r as ActivityLogRow));
  });
}

export async function saveActivityLog(tenant: string, record: ActivityLog): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(userActivityLogs)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        userId: record.userId,
        action: record.action,
        module: record.module,
        detail: record.detail ?? "",
        ts: record.ts,
        ip: record.ip ?? "",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userActivityLogs.workspaceSubdomain, userActivityLogs.id],
        set: {
          userId: sql`excluded.user_id`,
          action: sql`excluded.action`,
          module: sql`excluded.module`,
          detail: sql`excluded.detail`,
          ts: sql`excluded.ts`,
          ip: sql`excluded.ip`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveActivityLogs(tenant: string, records: ActivityLog[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, ActivityLog>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(userActivityLogs)
      .values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          userId: record.userId,
          action: record.action,
          module: record.module,
          detail: record.detail ?? "",
          ts: record.ts,
          ip: record.ip ?? "",
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [userActivityLogs.workspaceSubdomain, userActivityLogs.id],
        set: {
          userId: sql`excluded.user_id`,
          action: sql`excluded.action`,
          module: sql`excluded.module`,
          detail: sql`excluded.detail`,
          ts: sql`excluded.ts`,
          ip: sql`excluded.ip`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceActivityLogsForWorkspace(
  tenant: string,
  records: ActivityLog[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, ActivityLog>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(userActivityLogs).where(eq(userActivityLogs.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(userActivityLogs).values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          userId: record.userId,
          action: record.action,
          module: record.module,
          detail: record.detail ?? "",
          ts: record.ts,
          ip: record.ip ?? "",
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    }
  });
}

export async function deleteLogsByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(userActivityLogs).where(eq(userActivityLogs.workspaceSubdomain, subdomain));
  });
}
