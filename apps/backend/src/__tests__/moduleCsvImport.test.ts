import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { z } from "zod";
import { registerModuleCsvImportRoutes } from "../lib/registerModuleCsvImportRoutes.js";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import * as workerService from "../services/backgroundJobWorkerService.js";
import * as tenantContext from "../lib/tenantContext.js";

vi.mock("../services/backgroundJobWorkerService.js", () => ({
  enqueueBackgroundJob: vi.fn(),
  getUserBackgroundJob: vi.fn(),
  registerBackgroundJobRunner: vi.fn(),
  QueueUnavailableError: class QueueUnavailableError extends Error {},
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: vi.fn(),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
  mapActionStringToAuditType: vi.fn().mockReturnValue("IMPORT"),
}));

describe("registerModuleCsvImportRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects forbidden users", async () => {
    const fastify = Fastify();
    fastify.addHook("onRequest", async (req) => {
      req.user = { id: 1, role: "viewer", email: "v@test.com" } as any;
    });

    registerModuleCsvImportRoutes(fastify, {
      canWrite: () => false,
      bodySchema: z.object({ rows: z.array(z.any()) }),
      moduleId: "test-mod",
      defaultLabel: "Importing test",
      entityNoun: "item",
      queueAuditAction: "test.import",
    });

    const res = await fastify.inject({
      method: "POST",
      url: "/import",
      payload: { rows: [{ a: 1 }] },
    });

    expect(res.statusCode).toBe(403);
  });

  it("enqueues job and records audit on valid request", async () => {
    vi.mocked(tenantContext.getRequestTenant).mockReturnValue("demo-tenant");
    vi.mocked(workerService.getUserBackgroundJob).mockResolvedValue(null);
    vi.mocked(workerService.enqueueBackgroundJob).mockResolvedValue({
      id: "job-123",
      moduleId: "test-mod",
      kind: "import",
      status: "running",
      label: "Importing test",
      createdAt: new Date().toISOString(),
    });

    const fastify = Fastify();
    fastify.addHook("onRequest", async (req) => {
      req.user = { id: 42, role: "admin", email: "admin@test.com" } as any;
    });

    registerModuleCsvImportRoutes(fastify, {
      canWrite: () => true,
      bodySchema: z.object({ rows: z.array(z.any()) }),
      moduleId: "test-mod",
      defaultLabel: "Importing test",
      entityNoun: "item",
      queueAuditAction: "test.import",
    });

    const res = await fastify.inject({
      method: "POST",
      url: "/import",
      payload: { rows: [{ id: 1 }, { id: 2 }] },
    });

    expect(res.statusCode).toBe(202);
    expect(workerService.enqueueBackgroundJob).toHaveBeenCalledWith(
      "demo-tenant",
      "42",
      expect.objectContaining({ moduleId: "test-mod", kind: "import" }),
      expect.objectContaining({ rows: [{ id: 1 }, { id: 2 }] }),
    );
  });
});

describe("registerModuleCsvImportJobRunner", () => {
  it("registers runner and tracks progress", async () => {
    let registeredRunner: any;
    vi.mocked(workerService.registerBackgroundJobRunner).mockImplementation((_key, runner) => {
      registeredRunner = runner;
    });

    const mockImportBatch = vi.fn().mockResolvedValue({ imported: 5, total: 5 });

    registerModuleCsvImportJobRunner({
      moduleId: "test-mod",
      entityNounPlural: "items",
      importBatch: mockImportBatch,
    });

    expect(workerService.registerBackgroundJobRunner).toHaveBeenCalledWith(
      "test-mod:import",
      expect.any(Function),
    );

    const mockCtx = {
      tenant: "demo-tenant",
      userId: "42",
      jobId: "job-123",
      updateProgress: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
    };

    await registeredRunner({ rows: [1, 2, 3, 4, 5], viewerRole: "admin" }, mockCtx);

    expect(mockCtx.updateProgress).toHaveBeenCalledWith(0, 5);
    expect(mockImportBatch).toHaveBeenCalled();
    expect(mockCtx.complete).toHaveBeenCalledWith({
      label: "Imported 5 of 5 items",
      progress: { current: 5, total: 5 },
    });
  });
});
