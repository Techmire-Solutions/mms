import { describe, expect, it, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { User } from "@mms/shared";
import { z } from "zod";

/**
 * The enqueue guard: a module route must not accept a job the worker cannot run.
 *
 * Before the guard, `POST /api/attendance/export/csv` answered 202 and the job dead-lettered three
 * attempts later because no `attendance:export` runner existed.
 */

const mocks = vi.hoisted(() => ({
  hasRunner: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("../services/backgroundJobWorkerService.js", () => ({
  hasBackgroundJobRunner: mocks.hasRunner,
  enqueueBackgroundJob: mocks.enqueue,
  getUserBackgroundJob: vi.fn(),
  getUserBackgroundJobPayload: vi.fn(),
  QueueUnavailableError: class QueueUnavailableError extends Error {},
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn(),
  mapActionStringToAuditType: () => "UPDATE",
}));
vi.mock("../lib/tenantContext.js", () => ({ getRequestTenant: () => "demo" }));

const { registerModuleCsvExportRoutes } = await import("../lib/registerModuleCsvExportRoutes.js");
const { registerModuleCsvImportRoutes } = await import("../lib/registerModuleCsvImportRoutes.js");

const USER = { id: "u-1", role: "admin" } as unknown as User;
const bodySchema = z.object({}).passthrough();

function app() {
  const fastify = Fastify({ logger: false });
  fastify.addHook("preHandler", async (request) => {
    (request as { user?: User }).user = USER;
  });
  return fastify;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CSV export enqueue guard", () => {
  it("refuses with 503 when the module has no export runner", async () => {
    mocks.hasRunner.mockReturnValue(false);
    const fastify = app();
    registerModuleCsvExportRoutes(fastify, {
      canRead: () => true,
      canDeleteTrash: () => false,
      bodySchema,
      moduleId: "attendance",
      defaultLabel: "Exporting attendance records…",
      entityNoun: "attendance record",
      exportAuditAction: "attendance.export",
      queueAuditAction: "attendance.export.queue",
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/export/csv",
      payload: { query: {} },
    });
    await fastify.close();

    expect(response.statusCode).toBe(503);
    expect(mocks.hasRunner).toHaveBeenCalledWith("attendance:export");
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("queues once the runner exists", async () => {
    mocks.hasRunner.mockReturnValue(true);
    mocks.enqueue.mockResolvedValue({
      id: "job-1",
      moduleId: "attendance",
      kind: "export",
      status: "pending",
      label: "Export",
    });
    const fastify = app();
    registerModuleCsvExportRoutes(fastify, {
      canRead: () => true,
      canDeleteTrash: () => false,
      bodySchema,
      moduleId: "attendance",
      defaultLabel: "Exporting attendance records…",
      entityNoun: "attendance record",
      exportAuditAction: "attendance.export",
      queueAuditAction: "attendance.export.queue",
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/export/csv",
      payload: { query: {} },
    });
    await fastify.close();

    expect(response.statusCode).toBe(202);
    expect(mocks.enqueue).toHaveBeenCalled();
  });
});

describe("CSV import enqueue guard", () => {
  it("refuses the attendance import with 503 (no runner)", async () => {
    mocks.hasRunner.mockReturnValue(false);
    const fastify = app();
    registerModuleCsvImportRoutes(fastify, {
      canWrite: () => true,
      bodySchema: z.object({ rows: z.array(z.record(z.string(), z.unknown())) }).passthrough(),
      moduleId: "attendance",
      defaultLabel: "Importing attendance records…",
      entityNoun: "attendance record",
      queueAuditAction: "attendance.import",
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/import",
      payload: { rows: [{ date: "2026-03-02" }] },
    });
    await fastify.close();

    expect(response.statusCode).toBe(503);
    expect(mocks.hasRunner).toHaveBeenCalledWith("attendance:import");
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
