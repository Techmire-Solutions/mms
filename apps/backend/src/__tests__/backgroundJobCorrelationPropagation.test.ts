import { describe, expect, it, vi } from "vitest";

const { txMock } = vi.hoisted(() => {
  const row = {
    id: "job-1",
    tenantId: "tenant-1",
    userId: "user-1",
    moduleId: "contacts",
    kind: "export",
    status: "running",
    label: "Export",
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
      set: (values: Record<string, unknown>) => ({
        where: () => ({ returning: async () => [{ ...row, ...values }] }),
      }),
    }),
  };
  return { txMock: tx };
});

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback(txMock),
}));
vi.mock("../lib/backgroundJobModuleAccess.js", () => ({
  resolveBackgroundJobAccessContext: vi.fn().mockResolvedValue({
    denial: null,
    viewerRole: null,
    allowDeleted: undefined,
  }),
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

// The real tenantContext module is exercised so the binding actually stores into AsyncLocalStorage.
import { executeJob, registerBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";
import { getRequestAuditContext } from "../lib/tenantContext.js";

describe("executeJob correlation propagation", () => {
  it("binds the enqueue-time traceparent into the worker audit context", async () => {
    let observed: string | undefined;

    registerBackgroundJobRunner("contacts:export", async () => {
      observed = getRequestAuditContext()?.correlationId;
    });

    const traceparent = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
    await executeJob("tenant-1", "user-1", "job-1", "contacts", "export", {
      correlationId: traceparent,
    });

    expect(observed).toBe(traceparent);
  });

  it("leaves the audit context unset when the payload carries no correlation id", async () => {
    let observed: unknown = "sentinel";

    registerBackgroundJobRunner("contacts:export", async () => {
      observed = getRequestAuditContext()?.correlationId;
    });

    await executeJob("tenant-1", "user-1", "job-2", "contacts", "export", {});

    expect(observed).toBeUndefined();
  });
});
