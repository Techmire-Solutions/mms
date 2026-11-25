import { beforeEach, describe, expect, it } from "vitest";
import {
  calculateTenantFairSharePriority,
  incrementTenantInflightJobs,
  decrementTenantInflightJobs,
  getTenantInflightJobsCount,
} from "../worker/queues/index.js";
import { TENANT_PRIORITY_BANDS } from "../worker/queues/queueConfig.js";
import { redisDel } from "../lib/redis.js";

describe("Tenant Fair-Share Priority Scheduling", () => {
  const testTenant = "test-fairshare-tenant";

  beforeEach(async () => {
    await redisDel(`mms:tenant:${testTenant}:inflight_jobs`);
  });

  it("assigns Band 1 (highest priority) when tenant has 0 or 1 inflight jobs", async () => {
    const initialCount = await getTenantInflightJobsCount(testTenant);
    expect(initialCount).toBe(0);

    const priorityZero = await calculateTenantFairSharePriority(testTenant, 2);
    expect(priorityZero).toBe(TENANT_PRIORITY_BANDS.BAND_1_LOW_LOAD);

    await incrementTenantInflightJobs(testTenant);
    const countOne = await getTenantInflightJobsCount(testTenant);
    expect(countOne).toBe(1);

    const priorityOne = await calculateTenantFairSharePriority(testTenant, 2);
    expect(priorityOne).toBe(TENANT_PRIORITY_BANDS.BAND_1_LOW_LOAD);
  });

  it("assigns Band 2 (normal priority) when tenant has between 2 and 5 inflight jobs", async () => {
    // Increment to 3 jobs
    await incrementTenantInflightJobs(testTenant);
    await incrementTenantInflightJobs(testTenant);
    await incrementTenantInflightJobs(testTenant);

    const countThree = await getTenantInflightJobsCount(testTenant);
    expect(countThree).toBe(3);

    const priorityThree = await calculateTenantFairSharePriority(testTenant, 1);
    expect(priorityThree).toBe(TENANT_PRIORITY_BANDS.BAND_2_NORMAL_LOAD);
  });

  it("deprioritizes tenant to Band 3 (high load band) when tenant exceeds 5 inflight jobs", async () => {
    for (let i = 0; i < 6; i++) {
      await incrementTenantInflightJobs(testTenant);
    }

    const countSix = await getTenantInflightJobsCount(testTenant);
    expect(countSix).toBe(6);

    const prioritySix = await calculateTenantFairSharePriority(testTenant, 1);
    expect(prioritySix).toBe(TENANT_PRIORITY_BANDS.BAND_3_HIGH_LOAD);

    // Decrement back down
    await decrementTenantInflightJobs(testTenant);
    const countFive = await getTenantInflightJobsCount(testTenant);
    expect(countFive).toBe(5);

    const priorityFive = await calculateTenantFairSharePriority(testTenant, 1);
    expect(priorityFive).toBe(TENANT_PRIORITY_BANDS.BAND_2_NORMAL_LOAD);
  });
});
