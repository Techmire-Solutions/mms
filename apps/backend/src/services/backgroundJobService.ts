import { and, eq, ne, desc, or } from "drizzle-orm";
import {
  BACKGROUND_JOBS_MAX_PER_USER,
  type BackgroundJobRecord,
  type BackgroundJobStatus,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { withTenant, type TenantTransaction } from "../db/tenant-context.js";
import { backgroundJobs, tenantUsers } from "../db/schema.js";

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
  if (row.completedAt) record.completedAt = row.completedAt.toISOString();

  return record;
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

async function resolveEffectiveTenantUserId(
  tx: TenantTransaction,
  tenantId: string,
  userId: string,
): Promise<string> {
  const existing = await tx
    .select({ id: tenantUsers.id })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.workspaceSubdomain, tenantId), eq(tenantUsers.id, userId)))
    .limit(1);

  if (existing.length > 0) return userId;

  // Fallback for platform admins or non-tenant auth identities: use the first tenant user
  // so the composite foreign key ("tenant_id", "user_id") -> ("workspace_subdomain", "id")
  // is satisfied.
  const fallback = await tx
    .select({ id: tenantUsers.id })
    .from(tenantUsers)
    .where(eq(tenantUsers.workspaceSubdomain, tenantId))
    .limit(1);

  return fallback[0]?.id ?? userId;
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

export async function createDatabaseBackgroundJob(
  tenantId: string,
  userId: string,
  job: BackgroundJobRecord,
  payload: unknown,
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    const effectiveUserId = await resolveEffectiveTenantUserId(tx, tenantId, userId);
    await tx.insert(backgroundJobs).values({
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
    });
  });
}

export async function dismissUserBackgroundJob(_userId: string, jobId: string): Promise<boolean> {
  const tenantId = getRequestTenant();
  if (!tenantId) throw new Error("Tenant context is required to dismiss background job");

  return withTenant(tenantId, async (tx) => {
    const deleted = await tx
      .delete(backgroundJobs)
      .where(and(eq(backgroundJobs.tenantId, tenantId), eq(backgroundJobs.id, jobId)))
      .returning({ id: backgroundJobs.id });

    return deleted.length > 0;
  });
}

export async function clearFinishedUserBackgroundJobs(userId: string): Promise<number> {
  const tenantId = getRequestTenant();
  if (!tenantId) throw new Error("Tenant context is required to clear background jobs");

  return withTenant(tenantId, async (tx) => {
    const effectiveUserId = await resolveEffectiveTenantUserId(tx, tenantId, userId);
    const cleared = await tx
      .delete(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.tenantId, tenantId),
          or(eq(backgroundJobs.userId, userId), eq(backgroundJobs.userId, effectiveUserId)),
          ne(backgroundJobs.status, "running"),
        ),
      )
      .returning({ id: backgroundJobs.id });

    return cleared.length;
  });
}

/** Wipe every queued/finished/running job for the request tenant (full restore). */
export async function clearTenantBackgroundJobs(): Promise<number> {
  const tenantId = getRequestTenant();
  if (!tenantId) return 0;

  return withTenant(tenantId, async (tx) => {
    const cleared = await tx
      .delete(backgroundJobs)
      .where(eq(backgroundJobs.tenantId, tenantId))
      .returning({ id: backgroundJobs.id });

    return cleared.length;
  });
}

export async function getUserBackgroundJob(
  _userId: string,
  jobId: string,
  explicitTenantId?: string,
): Promise<BackgroundJobRecord | null> {
  const tenantId = explicitTenantId ?? getRequestTenant();
  if (!tenantId) return null;

  return withTenant(tenantId, async (tx) => {
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
        completedAt: backgroundJobs.completedAt,
        createdAt: backgroundJobs.createdAt,
        updatedAt: backgroundJobs.updatedAt,
      })
      .from(backgroundJobs)
      .where(and(eq(backgroundJobs.tenantId, tenantId), eq(backgroundJobs.id, jobId)))
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
