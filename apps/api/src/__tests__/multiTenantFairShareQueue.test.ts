import { describe, expect, it } from "vitest";
import {
  calculateTenantFairSharePriority,
  incrementTenantInflightJobs,
  decrementTenantInflightJobs,
  getTenantInflightJobsCount,
} from "../worker/queues/index.js";
import { TENANT_PRIORITY_BANDS } from "../worker/queues/queueConfig.js";

describe("Multi-Tenant Fair-Share Queue Scheduling", () => {
  it("assigns Band 1 priority when tenant has 0 inflight jobs", async () => {
    const tenant = "tenant-idle";
    const priority = await calculateTenantFairSharePriority(tenant);
    expect(priority).toBe(TENANT_PRIORITY_BANDS.BAND_1_LOW_LOAD);
    expect(priority).toBe(1);
  });

  it("assigns Band 2 priority when tenant has 2-5 inflight jobs", async () => {
    const tenant = "tenant-moderate";
    await incrementTenantInflightJobs(tenant);
    await incrementTenantInflightJobs(tenant);
    expect(await getTenantInflightJobsCount(tenant)).toBe(2);

    const priority = await calculateTenantFairSharePriority(tenant);
    expect(priority).toBe(TENANT_PRIORITY_BANDS.BAND_2_NORMAL_LOAD);
    expect(priority).toBe(2);

    // Cleanup
    await decrementTenantInflightJobs(tenant);
    await decrementTenantInflightJobs(tenant);
    expect(await getTenantInflightJobsCount(tenant)).toBe(0);
  });

  it("assigns Band 3 priority when tenant has more than 5 inflight jobs", async () => {
    const tenant = "tenant-heavy";
    for (let i = 0; i < 6; i++) {
      await incrementTenantInflightJobs(tenant);
    }
    expect(await getTenantInflightJobsCount(tenant)).toBe(6);

    const priority = await calculateTenantFairSharePriority(tenant);
    expect(priority).toBe(TENANT_PRIORITY_BANDS.BAND_3_HIGH_LOAD);
    expect(priority).toBe(3);

    // Cleanup
    for (let i = 0; i < 6; i++) {
      await decrementTenantInflightJobs(tenant);
    }
    expect(await getTenantInflightJobsCount(tenant)).toBe(0);
  });

  it("ensures idle tenant jobs take priority over heavy tenant jobs", async () => {
    const heavyTenant = "tenant-bursting";
    const idleTenant = "tenant-starving";

    for (let i = 0; i < 7; i++) {
      await incrementTenantInflightJobs(heavyTenant);
    }

    const heavyPriority = await calculateTenantFairSharePriority(heavyTenant);
    const idlePriority = await calculateTenantFairSharePriority(idleTenant);

    // In BullMQ lower number = higher priority
    expect(idlePriority).toBeLessThan(heavyPriority);
    expect(idlePriority).toBe(1);
    expect(heavyPriority).toBe(3);

    // Cleanup
    for (let i = 0; i < 7; i++) {
      await decrementTenantInflightJobs(heavyTenant);
    }
  });

  it("prevents underflow when decrement is called beyond current count", async () => {
    const tenant = "tenant-underflow";
    expect(await getTenantInflightJobsCount(tenant)).toBe(0);

    // Decrement when already 0
    const count = await decrementTenantInflightJobs(tenant);
    expect(count).toBe(0);
    expect(await getTenantInflightJobsCount(tenant)).toBe(0);

    // Priority remains Band 1
    const priority = await calculateTenantFairSharePriority(tenant);
    expect(priority).toBe(TENANT_PRIORITY_BANDS.BAND_1_LOW_LOAD);
  });

  it("guarantees tenant isolation under distinct load distributions", async () => {
    const tenantA = "tenant-iso-a";
    const tenantB = "tenant-iso-b";

    // Tenant A gets 10 jobs
    for (let i = 0; i < 10; i++) {
      await incrementTenantInflightJobs(tenantA);
    }
    // Tenant B gets 1 job
    await incrementTenantInflightJobs(tenantB);

    expect(await getTenantInflightJobsCount(tenantA)).toBe(10);
    expect(await getTenantInflightJobsCount(tenantB)).toBe(1);

    expect(await calculateTenantFairSharePriority(tenantA)).toBe(
      TENANT_PRIORITY_BANDS.BAND_3_HIGH_LOAD,
    );
    expect(await calculateTenantFairSharePriority(tenantB)).toBe(
      TENANT_PRIORITY_BANDS.BAND_1_LOW_LOAD,
    );

    // Cleanup
    for (let i = 0; i < 10; i++) {
      await decrementTenantInflightJobs(tenantA);
    }
    await decrementTenantInflightJobs(tenantB);

    expect(await getTenantInflightJobsCount(tenantA)).toBe(0);
    expect(await getTenantInflightJobsCount(tenantB)).toBe(0);
  });

  it("handles highly concurrent atomic increments and decrements without race conditions", async () => {
    const tenant = "tenant-concurrency";
    const concurrentCount = 50;

    // Concurrently increment 50 times
    await Promise.all(
      Array.from({ length: concurrentCount }, () => incrementTenantInflightJobs(tenant)),
    );
    expect(await getTenantInflightJobsCount(tenant)).toBe(concurrentCount);

    // Concurrently decrement 50 times
    await Promise.all(
      Array.from({ length: concurrentCount }, () => decrementTenantInflightJobs(tenant)),
    );
    expect(await getTenantInflightJobsCount(tenant)).toBe(0);
  });
});
