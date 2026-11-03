import { redisGet, redisIncr, redisDecr } from "../../lib/redis.js";
import { TENANT_PRIORITY_BANDS } from "./queueConfig.js";

/**
 * Inflight jobs tracking per tenant for fair-share background scheduling.
 */
export async function getTenantInflightJobsCount(tenantId: string): Promise<number> {
  const normTenant = tenantId.trim().toLowerCase();
  const key = `mms:tenant:${normTenant}:inflight_jobs`;
  const val = await redisGet(key);
  return val ? Number.parseInt(val, 10) || 0 : 0;
}

export async function incrementTenantInflightJobs(tenantId: string): Promise<number> {
  const normTenant = tenantId.trim().toLowerCase();
  const key = `mms:tenant:${normTenant}:inflight_jobs`;
  return redisIncr(key, 3600);
}

export async function decrementTenantInflightJobs(tenantId: string): Promise<number> {
  const normTenant = tenantId.trim().toLowerCase();
  const key = `mms:tenant:${normTenant}:inflight_jobs`;
  return redisDecr(key, 3600);
}

/**
 * Calculates fair-share priority band for a tenant based on current inflight load.
 * Lower numerical priority value in BullMQ means higher execution precedence (1 = highest).
 */
export async function calculateTenantFairSharePriority(
  tenantId: string,
  basePriority = 2,
): Promise<number> {
  const inflight = await getTenantInflightJobsCount(tenantId);
  if (inflight <= 1) {
    return Math.min(basePriority, TENANT_PRIORITY_BANDS.BAND_1_LOW_LOAD);
  }
  if (inflight <= 5) {
    return Math.max(basePriority, TENANT_PRIORITY_BANDS.BAND_2_NORMAL_LOAD);
  }
  return TENANT_PRIORITY_BANDS.BAND_3_HIGH_LOAD;
}
