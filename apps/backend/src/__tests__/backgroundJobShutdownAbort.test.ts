import { beforeEach, describe, expect, it, vi } from "vitest";

const { txMock, patches } = vi.hoisted(() => {
  const patches: Array<Record<string, unknown>> = [];
  const row = {
    id: "job-1",
    tenantId: "tenant-1",
    userId: "user-1",
    moduleId: "messaging",
    kind: "dispatch",
    status: "running",
    label: "Campaign",
    payload: {},
    progressCurrent: null,
    progressTotal: null,
    artifactId: null,
    hasDownload: false,
    error: null,
    completedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const tx = {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        patches.push(values);
        return { where: () => ({ returning: async () => [{ ...row, ...values }] }) };
      },
    }),
  };
  return { txMock: tx, patches };
});

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback(txMock),
}));
vi.mock("../lib/tenantContext.js", () => ({
  runWithTenant: (_tenant: string, callback: () => Promise<unknown>) => callback(),
}));
vi.mock("../lib/backgroundJobModuleAccess.js", () => ({
  getBackgroundJobModuleDenial: vi.fn().mockResolvedValue(null),
}));
vi.mock("../worker/pubsub/jobPubSub.js", () => ({
  publishJobEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/backgroundJobService.js", () => ({
  rowToJobRecord: (row: { id: string; status: string }) => row,
  createDatabaseBackgroundJob: vi.fn(),
  getUserBackgroundJob: vi.fn(),
  getUserBackgroundJobPayload: vi.fn(),
}));

import {
  abortBackgroundJobsOnShutdown,
  resetBackgroundJobShutdownForTests,
} from "../services/backgroundJobDeadline.js";
import { executeJob, registerBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";

describe("worker shutdown abort", () => {
  beforeEach(() => {
    patches.length = 0;
    resetBackgroundJobShutdownForTests();
  });

  it("aborts an in-flight messaging job and settles it as failed", async () => {
    registerBackgroundJobRunner("messaging:dispatch", async (_payload, ctx) => {
      await new Promise<void>((resolve) => {
        ctx.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
      throw new Error("campaign interrupted");
    });

    const run = executeJob("tenant-1", "user-1", "job-1", "messaging", "dispatch", {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    abortBackgroundJobsOnShutdown("SIGTERM");

    await expect(run).rejects.toThrow();
    const failed = patches.find((patch) => patch.status === "failed");
    expect(failed?.error).toBe("Worker is shutting down");
  });
});
