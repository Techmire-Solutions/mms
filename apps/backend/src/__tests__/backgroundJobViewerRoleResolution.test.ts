import { describe, expect, it, vi } from "vitest";

const { txMock } = vi.hoisted(() => {
  const row = {
    id: "job-1",
    tenantId: "tenant-1",
    userId: "user-1",
    moduleId: "students",
    kind: "import",
    status: "running",
    label: "Import",
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
    viewerRole: "viewer",
    allowDeleted: true,
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

import { executeJob } from "../services/backgroundJobWorkerService.js";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";

describe("runner re-scoping at execution", () => {
  it("passes the re-resolved viewerRole to the import runner, not the enqueue snapshot", async () => {
    let receivedViewerRole: string | undefined;

    registerModuleCsvImportJobRunner<{ name: string }>({
      moduleId: "students",
      entityNounPlural: "students",
      importBatch: async (_rows, ctx) => {
        receivedViewerRole = ctx.viewerRole;
        return { imported: 1, total: 1 };
      },
    });

    await executeJob("tenant-1", "user-1", "job-1", "students", "import", {
      rows: [{ name: "X" }],
      viewerRole: "stale-admin",
    });

    expect(receivedViewerRole).toBe("viewer");
  });
});
