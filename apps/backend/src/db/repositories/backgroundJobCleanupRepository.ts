import { and, eq, or } from "drizzle-orm";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { backgroundJobs, tenantUsers } from "../schema.js";

/** Fallback identity that satisfies the (tenant,user) FK for non-tenant sessions. */
export async function resolveEffectiveTenantUserId(
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

  const fallback = await tx
    .select({ id: tenantUsers.id })
    .from(tenantUsers)
    .where(eq(tenantUsers.workspaceSubdomain, tenantId))
    .limit(1);

  return fallback[0]?.id ?? userId;
}

/** Statuses that `clear-finished` may delete; queued/running work is preserved. */
export const CLEARABLE_BACKGROUND_JOB_STATUSES = ["completed", "failed"] as const;

export async function clearFinishedUserBackgroundJobs(userId: string): Promise<string[]> {
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
          or(
            ...CLEARABLE_BACKGROUND_JOB_STATUSES.map((status) => eq(backgroundJobs.status, status)),
          ),
        ),
      )
      .returning({ id: backgroundJobs.id });

    return cleared.map((row) => row.id);
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
