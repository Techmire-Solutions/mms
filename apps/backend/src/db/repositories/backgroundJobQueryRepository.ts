import { and, eq, gte, or, sql } from "drizzle-orm";
import type { BackgroundJobRecord, BackgroundJobStatus } from "@mms/shared";
import { withTenant } from "../tenant-context.js";
import { backgroundJobs } from "../schema.js";
import { resolveEffectiveTenantUserId } from "./backgroundJobCleanupRepository.js";

/**
 * Read-side background-job queries, split from `backgroundJobService.ts` for the 300-line band.
 * `rowToJobRecord` lives here so both the service and the entity-lock query share one mapper.
 */

/**
 * Safely converts a Date or date string to an ISO 8601 string, with resilient fallback.
 */
export function toSafeIsoString(
  date: Date | string | null | undefined,
  fallback = new Date().toISOString(),
): string {
  if (!date) return fallback;
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? fallback : date.toISOString();
  }
  if (typeof date === "string") {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? date : parsed.toISOString();
  }
  return fallback;
}

export function rowToJobRecord(row: {
  id: string;
  moduleId: string;
  kind: string;
  status: string;
  label: string;
  hasDownload?: boolean | null;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  error?: string | null;
  errors?: Array<{ row: number; reason: string }> | null;
  createdAt: Date | string | null | undefined;
  completedAt?: Date | string | null | undefined;
  [key: string]: unknown;
}): BackgroundJobRecord {
  const safeCreatedAt = toSafeIsoString(row.createdAt);
  const record: BackgroundJobRecord = {
    id: String(row.id),
    moduleId: String(row.moduleId),
    kind: String(row.kind),
    status: (row.status as BackgroundJobStatus) || "pending",
    label: String(row.label ?? ""),
    hasDownload: Boolean(row.hasDownload),
    createdAt: safeCreatedAt,
  };

  if (
    row.progressCurrent !== null &&
    row.progressCurrent !== undefined &&
    row.progressTotal !== null &&
    row.progressTotal !== undefined
  ) {
    record.progress = {
      current: Number(row.progressCurrent),
      total: Number(row.progressTotal),
    };
  }
  if (row.error) record.error = String(row.error);
  if (row.errors && Array.isArray(row.errors)) record.errors = row.errors;
  if (row.completedAt) {
    const safeCompleted = toSafeIsoString(row.completedAt, "");
    if (safeCompleted) record.completedAt = safeCompleted;
  }

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
        moduleId: backgroundJobs.moduleId,
        kind: backgroundJobs.kind,
        status: backgroundJobs.status,
        label: backgroundJobs.label,
        progressCurrent: backgroundJobs.progressCurrent,
        progressTotal: backgroundJobs.progressTotal,
        hasDownload: backgroundJobs.hasDownload,
        error: backgroundJobs.error,
        errors: backgroundJobs.errors,
        completedAt: backgroundJobs.completedAt,
        createdAt: backgroundJobs.createdAt,
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
