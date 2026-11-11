import { and, eq, gte, or, sql } from "drizzle-orm";
import type { BackgroundJobRecord, BackgroundJobStatus } from "@mms/shared";
import { withTenant } from "../tenant-context.js";
import { backgroundJobs } from "../schema.js";
import { resolveEffectiveTenantUserId } from "./backgroundJobCleanupRepository.js";

/**
 * Read-side background-job queries, split from `backgroundJobService.ts` for the 300-line band.
 * `rowToJobRecord` lives here so both the service and the entity-lock query share one mapper.
 */

export function rowToJobRecord(row: typeof backgroundJobs.$inferSelect): BackgroundJobRecord {
  const record: BackgroundJobRecord = {
    id: row.id,
    moduleId: row.moduleId,
    kind: row.kind,
    status: row.status as BackgroundJobStatus,
    label: row.label,
    hasDownload: row.hasDownload,
    createdAt: row.createdAt.toISOString(),
  };

  if (row.progressCurrent !== null && row.progressTotal !== null) {
    record.progress = { current: row.progressCurrent, total: row.progressTotal };
  }
  if (row.error) record.error = row.error;
  if (row.errors) record.errors = row.errors;
  if (row.completedAt) record.completedAt = row.completedAt.toISOString();

  return record;
}

/** Number of retained jobs for the user (and the caller's effective identity). */
export async function countBackgroundJobsForUser(
  tenantId: string,
  userId: string,
): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    const effectiveUserId = await resolveEffectiveTenantUserId(tx, tenantId, userId);
    const [row] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.tenantId, tenantId),
          or(eq(backgroundJobs.userId, userId), eq(backgroundJobs.userId, effectiveUserId)),
        ),
      );
    return Number(row?.total ?? 0);
  });
}

/** A live (pending/running) job for one entity key — e.g. a marks import already running. */
export async function findLiveBackgroundJob(
  tenantId: string,
  moduleId: string,
  kind: string,
  payloadKey: string,
  payloadValue: string,
  freshnessMs = 15 * 60 * 1000,
): Promise<BackgroundJobRecord | null> {
  return withTenant(tenantId, async (tx) => {
    const cutoff = new Date(Date.now() - freshnessMs);
    const rows = await tx
      .select({
        id: backgroundJobs.id,
        tenantId: backgroundJobs.tenantId,
        userId: backgroundJobs.userId,
        moduleId: backgroundJobs.moduleId,
        kind: backgroundJobs.kind,
        status: backgroundJobs.status,
        label: backgroundJobs.label,
        payload: backgroundJobs.payload,
        progressCurrent: backgroundJobs.progressCurrent,
        progressTotal: backgroundJobs.progressTotal,
        artifactId: backgroundJobs.artifactId,
        hasDownload: backgroundJobs.hasDownload,
        error: backgroundJobs.error,
        errors: backgroundJobs.errors,
        deadLetteredAt: backgroundJobs.deadLetteredAt,
        completedAt: backgroundJobs.completedAt,
        createdAt: backgroundJobs.createdAt,
        updatedAt: backgroundJobs.updatedAt,
      })
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.tenantId, tenantId),
          eq(backgroundJobs.moduleId, moduleId),
          eq(backgroundJobs.kind, kind),
          or(eq(backgroundJobs.status, "pending"), eq(backgroundJobs.status, "running")),
          sql`${backgroundJobs.payload} ->> ${payloadKey} = ${payloadValue}`,
          gte(backgroundJobs.updatedAt, cutoff),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToJobRecord(row) : null;
  });
}
