import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hasanat queue-pipeline contract.
 *
 * The failure this guards against: the runners were registered from a route plugin, so the API
 * accepted a job the worker could never run (`No runner registered` → 3 attempts → DLQ, zero cards).
 */

const adapterState = vi.hoisted(() => ({
  existingOnSecondCall: true,
  callCount: 0,
  insertedIds: ["hd1", "hd2"] as string[],
  insertCalls: 0,
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, fn: (tx: unknown) => Promise<unknown>) => fn({}),
  withTenantRead: async (_tenant: string, fn: (tx: unknown) => Promise<unknown>) => fn({}),
}));

vi.mock("../hasanat/repository/hasanatRepositoryAdapter.js", () => ({
  hasanatRepository: {
    getModulePreferences: vi.fn(async () => ({})),
  },
  listDenomsByWorkspace: vi.fn(async () => [
    { id: "den1", name: "Gold", points: 50, active: true },
  ]),
  listBatchesByWorkspace: vi.fn(async () => [
    { id: "bat1", denominationId: "den1", remaining: 10 },
  ]),
  findStudentsByNames: vi.fn(async () => [
    { studentId: "stu1", studentName: "Fatima" },
    { studentId: "stu2", studentName: "Aisha" },
  ]),
  findDistributionsByClientRequestIds: vi.fn(async (_tenant: string, ids: string[]) => {
    adapterState.callCount += 1;
    if (!adapterState.existingOnSecondCall) return [];
    return adapterState.callCount > 1 ? ids.map((id) => ({ clientRequestId: id })) : [];
  }),
  insertBatchDistributions: vi.fn(async () => {
    adapterState.insertCalls += 1;
    return adapterState.insertedIds;
  }),
}));

vi.mock("../hasanat/use-cases/hasanatTierUseCases.js", () => ({
  reconcileTiersForStudents: vi.fn(async () => ({ students: 0, awarded: 0, revoked: 0 })),
}));

vi.mock("../hasanat/use-cases/hasanatAwardScope.js", () => ({
  assertAwardScope: vi.fn(async () => undefined),
  resolveAwardScopeBypass: vi.fn(async () => true),
}));

vi.mock("../hasanat/use-cases/hasanatAudit.js", () => ({
  auditCardState: vi.fn(async () => undefined),
  auditCardMutation: vi.fn(async () => undefined),
}));

vi.mock("../hasanat/use-cases/hasanatBatchAwardUseCases.js", () => ({
  resolveBatchAwardRecipients: vi.fn(async () => [
    { studentId: "stu1", studentName: "Fatima", classId: "c1", sessionId: "s1" },
    { studentId: "stu2", studentName: "Aisha", classId: "c1", sessionId: "s1" },
  ]),
  issueHasanatCardsBatch: vi.fn(async () => ({
    issued: 1,
    distributionIds: ["hd1"],
    skipped: [],
    queued: false,
  })),
}));

import { importHasanatRows } from "../hasanat/use-cases/hasanatImportJob.js";
import type { HasanatTransferEntity } from "@mms/shared";
import { runHasanatBulkAwardJob } from "../hasanat/use-cases/hasanatBatchAwardJob.js";
import { registerHasanatJobRunners } from "../services/backgroundJobHasanatRunners.js";
import { hasBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";
import {
  QUEUE_HASANAT_AWARDS,
  resolveJobExecutionTimeoutMs,
  resolveQueueNameForJob,
} from "../worker/queues/index.js";

const ROWS: HasanatTransferEntity[] = [
  { title: "Hifz", category: "Gold", targetPerson: "Fatima", date: "2026-11-10" },
];

function importContext(overrides: Partial<{ signal: AbortSignal; jobId: string }> = {}) {
  return {
    tenant: "demo",
    userId: "u1",
    jobId: overrides.jobId ?? "job-1",
    signal: overrides.signal,
    updateProgress: vi.fn(async () => undefined),
  };
}

function jobContext(signal?: AbortSignal) {
  return {
    tenant: "demo",
    userId: "u1",
    jobId: "job-award",
    signal,
    updateProgress: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
  };
}

const BULK_PAYLOAD = {
  body: {
    batchId: "batch1",
    denominationId: "den1",
    target: { kind: "class", sessionId: "s1", classId: "c1" },
    reason: "Weekly halaqa",
    issuedDate: "2026-11-10",
    clientRequestId: "req-abcdefgh",
  },
  actorUserId: "u1",
  recipientCount: 2,
};

describe("hasanat job runner registration", () => {
  it("registers both job keys in the shared registry", () => {
    registerHasanatJobRunners();
    expect(hasBackgroundJobRunner("hasanat:bulk-award")).toBe(true);
    expect(hasBackgroundJobRunner("hasanat:import")).toBe(true);
  });

  it("routes award pipelines onto the dedicated queue with a 10-minute budget", () => {
    expect(resolveQueueNameForJob("hasanat", "bulk-award")).toBe(QUEUE_HASANAT_AWARDS);
    expect(resolveQueueNameForJob("hasanat", "import")).toBe(QUEUE_HASANAT_AWARDS);
    expect(resolveJobExecutionTimeoutMs("hasanat", "bulk-award")).toBeGreaterThan(60_000);
    expect(resolveJobExecutionTimeoutMs("hasanat", "import")).toBeGreaterThan(60_000);
  });
});

describe("hasanat:import retry safety", () => {
  beforeEach(() => {
    adapterState.callCount = 0;
    adapterState.insertCalls = 0;
    adapterState.existingOnSecondCall = true;
  });

  it("imports once and treats a replay as already-done instead of failing", async () => {
    const first = await importHasanatRows(ROWS, importContext());
    expect(first.imported).toBe(2);
    expect(adapterState.insertCalls).toBe(1);

    // Same job id → same deterministic client request ids → rows already exist.
    const second = await importHasanatRows(ROWS, importContext());
    expect(second.imported).toBe(0);
    expect(second.failed).toBe(ROWS.length);
    expect(adapterState.insertCalls).toBe(1);
  });

  it("refuses to start the write when the job was already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const before = adapterState.insertCalls;

    await expect(
      importHasanatRows(ROWS, importContext({ signal: controller.signal })),
    ).rejects.toThrow(/abort/i);
    expect(adapterState.insertCalls).toBe(before);
  });
});

describe("hasanat:bulk-award outcomes", () => {
  beforeEach(() => {
    adapterState.existingOnSecondCall = false;
  });

  it("completes a successful run", async () => {
    const ctx = jobContext();
    await runHasanatBulkAwardJob(BULK_PAYLOAD, ctx);
    expect(ctx.complete).toHaveBeenCalledOnce();
    expect(ctx.fail).not.toHaveBeenCalled();
  });

  it("fails instead of completing when the run was aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = jobContext(controller.signal);

    await expect(runHasanatBulkAwardJob(BULK_PAYLOAD, ctx)).rejects.toThrow(/aborted/i);
    expect(ctx.complete).not.toHaveBeenCalled();
  });

  it("fails when every chunk failed", async () => {
    const { issueHasanatCardsBatch } =
      await import("../hasanat/use-cases/hasanatBatchAwardUseCases.js");
    vi.mocked(issueHasanatCardsBatch)
      .mockRejectedValueOnce(new Error("quota_exceeded"))
      .mockRejectedValueOnce(new Error("quota_exceeded"));
    const ctx = jobContext();

    await expect(runHasanatBulkAwardJob(BULK_PAYLOAD, ctx)).rejects.toThrow(/issued 0 of 2/i);
    expect(ctx.complete).not.toHaveBeenCalled();
  });
});
