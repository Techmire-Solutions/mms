import { and, eq, desc, or } from "drizzle-orm";
import { BACKGROUND_JOBS_MAX_PER_USER, type BackgroundJobRecord } from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { withTenant } from "../db/tenant-context.js";
import { backgroundJobs } from "../db/schema.js";
import { resolveEffectiveTenantUserId } from "../db/repositories/backgroundJobCleanupRepository.js";
export {
  CLEARABLE_BACKGROUND_JOB_STATUSES,
  clearFinishedUserBackgroundJobs,
  clearTenantBackgroundJobs,
} from "../db/repositories/backgroundJobCleanupRepository.js";
import {
  countBackgroundJobsForUser,
  findLiveBackgroundJob,
  rowToJobRecord,
} from "../db/repositories/backgroundJobQueryRepository.js";

export { rowToJobRecord } from "../db/repositories/backgroundJobQueryRepository.js";

/** Thrown when a user already holds the maximum retained background jobs. */
export class BackgroundJobLimitError extends Error {
  constructor(max: number) {
    super(
      `Too many retained background jobs (limit ${max}); clear finished jobs from the task tray and retry`,
    );
    this.name = "BackgroundJobLimitError";
  }
}

/** Retained-job count for the caller (requests the tenant from ALS). */
export async function countUserBackgroundJobs(userId: string): Promise<number> {
  const tenantId = getRequestTenant();
  if (!tenantId) return 0;
  return countBackgroundJobsForUser(tenantId, userId);
}

/** A live (pending/running) job for one entity key — e.g. a marks import already running. */
export async function findLiveBackgroundJobForEntity(
  moduleId: string,
  kind: string,
  payloadKey: string,
  payloadValue: string,
): Promise<BackgroundJobRecord | null> {
  const tenantId = getRequestTenant();
  if (!tenantId) return null;
  return findLiveBackgroundJob(tenantId, moduleId, kind, payloadKey, payloadValue);
}

export async function listUserBackgroundJobs(userId: string): Promise<BackgroundJobRecord[]> {
  const tenantId = getRequestTenant();
  if (!tenantId) return [];

  return withTenant(tenantId, async (tx) => {
    const effectiveUserId = await resolveEffectiveTenantUserId(tx, tenantId, userId);
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
          or(eq(backgroundJobs.userId, userId), eq(backgroundJobs.userId, effectiveUserId)),
        ),
      )
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(BACKGROUND_JOBS_MAX_PER_USER);

    return rows.map(rowToJobRecord);
  });
}

export async function upsertUserBackgroundJob(
  userId: string,
  job: BackgroundJobRecord,
): Promise<BackgroundJobRecord> {
  const tenantId = getRequestTenant();
  if (!tenantId) throw new Error("Tenant context is required to upsert background job");

  const values = {
    id: job.id,
    tenantId,
    userId,
    moduleId: job.moduleId,
    kind: job.kind,
    status: job.status,
    label: job.label,
    payload: {},
    progressCurrent: job.progress?.current ?? null,
    progressTotal: job.progress?.total ?? null,
    artifactId: null,
    hasDownload: job.hasDownload ?? false,
    error: job.error ?? null,
    completedAt: job.completedAt ? new Date(job.completedAt) : null,
    updatedAt: new Date(),
  };

  await withTenant(tenantId, async (tx) => {
    const effectiveUserId = await resolveEffectiveTenantUserId(tx, tenantId, userId);
    values.userId = effectiveUserId;
    await tx
      .insert(backgroundJobs)
      .values(values)
      .onConflictDoUpdate({
        target: backgroundJobs.id,
        set: {
          status: job.status,
          label: job.label,
          progressCurrent: job.progress?.current ?? null,
          progressTotal: job.progress?.total ?? null,
          hasDownload: job.hasDownload ?? false,
          error: job.error ?? null,
          completedAt: job.completedAt ? new Date(job.completedAt) : null,
          updatedAt: new Date(),
        },
      });
  });

  return job;
}

/**
 * Inserts the job row unless an identical id already exists (double-submit race).
 * Returns `false` when the row pre-existed, so the caller can return the winner's job.
 */
export async function createDatabaseBackgroundJob(
  tenantId: string,
  userId: string,
  job: BackgroundJobRecord,
  payload: unknown,
): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const effectiveUserId = await resolveEffectiveTenantUserId(tx, tenantId, userId);
    const inserted = await tx
      .insert(backgroundJobs)
      .values({
        id: job.id,
        tenantId,
        userId: effectiveUserId,
        moduleId: job.moduleId,
        kind: job.kind,
        status: job.status,
        label: job.label,
        payload: payload as Record<string, unknown>,
        progressCurrent: job.progress?.current ?? null,
        progressTotal: job.progress?.total ?? null,
        hasDownload: job.hasDownload ?? false,
        error: job.error ?? null,
        completedAt: job.completedAt ? new Date(job.completedAt) : null,
      })
      .onConflictDoNothing({ target: backgroundJobs.id })
      .returning({ id: backgroundJobs.id });
    return inserted.length > 0;
  });
}

/**
 * Dismisses one job owned by the caller (or the caller's effective tenant
 * identity) and returns the owning user id so the route can delete the right
 * export artifact.
 */
export async function dismissUserBackgroundJob(
  userId: string,
  jobId: string,
): Promise<string | null> {
  const tenantId = getRequestTenant();
  if (!tenantId) throw new Error("Tenant context is required to dismiss background job");

  return withTenant(tenantId, async (tx) => {
    const effectiveUserId = await resolveEffectiveTenantUserId(tx, tenantId, userId);
    const deleted = await tx
      .delete(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.tenantId, tenantId),
          eq(backgroundJobs.id, jobId),
          or(eq(backgroundJobs.userId, userId), eq(backgroundJobs.userId, effectiveUserId)),
        ),
      )
      .returning({ id: backgroundJobs.id, userId: backgroundJobs.userId });

    return deleted[0]?.userId ?? null;
  });
}

/**
 * One job, scoped to its owner (or the owner's effective tenant identity).
 *
 * This used to ignore `userId`, so `GET /api/background-jobs/:id` and the artifact download served
 * any job in the tenant to any authenticated user who knew the id. Ownership is part of the read.
 */
export async function getUserBackgroundJob(
  userId: string,
  jobId: string,
  explicitTenantId?: string,
): Promise<BackgroundJobRecord | null> {
  const tenantId = explicitTenantId ?? getRequestTenant();
  if (!tenantId) return null;

  return withTenant(tenantId, async (tx) => {
    const effectiveUserId = await resolveEffectiveTenantUserId(tx, tenantId, userId);
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
          eq(backgroundJobs.id, jobId),
          or(eq(backgroundJobs.userId, userId), eq(backgroundJobs.userId, effectiveUserId)),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row ? rowToJobRecord(row) : null;
  });
}

/** Returns the stored enqueue payload for an existing user job (idempotency body binding). */
export async function getUserBackgroundJobPayload(
  userId: string,
  jobId: string,
  explicitTenantId?: string,
): Promise<Record<string, unknown> | null> {
  const tenantId = explicitTenantId ?? getRequestTenant();
  if (!tenantId) return null;

  return withTenant(tenantId, async (tx) => {
    const effectiveUserId = await resolveEffectiveTenantUserId(tx, tenantId, userId);
    const rows = await tx
      .select({ payload: backgroundJobs.payload })
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.tenantId, tenantId),
          or(eq(backgroundJobs.userId, userId), eq(backgroundJobs.userId, effectiveUserId)),
          eq(backgroundJobs.id, jobId),
        ),
      )
      .limit(1);

    return rows[0]?.payload ?? null;
  });
}
