/**
 * Faculty CSV import queue routes.
 *
 * Every other module routes its import through `registerModuleCsvImportRoutes`,
 * which appends one queue-level audit row (`<entity>.import`). Faculty used to
 * hand-roll the same handler without that row, so a bulk import left no audit
 * trail while the use case comments claimed an aggregate row existed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from "fastify";

const mocks = vi.hoisted(() => ({
  enqueueBackgroundJob: vi.fn(),
  getUserBackgroundJob: vi.fn(),
  recordModernAuditEvent: vi.fn(),
}));

vi.mock("../services/backgroundJobWorkerService.js", () => ({
  enqueueBackgroundJob: mocks.enqueueBackgroundJob,
  getUserBackgroundJob: mocks.getUserBackgroundJob,
  registerBackgroundJobRunner: vi.fn(),
  QueueUnavailableError: class QueueUnavailableError extends Error {},
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.recordModernAuditEvent,
  mapActionStringToAuditType: vi.fn(() => "IMPORT"),
}));

import { bindRequestTenant } from "../lib/tenantContext.js";
import { facultyImportRoutes } from "../routes/tenant/faculty/facultyImportRoutes.js";
import { facultyCatalogIoRoutes } from "../routes/tenant/faculty/facultyCatalogIoRoutes.js";

const ADMIN = { id: 7, role: "admin", email: "admin@test.com", workspaceSubdomain: "demo" };

/** Mirrors `authenticateTenant`: binds the user and the tenant for the request. */
function buildApp(plugin: FastifyPluginAsync, prefix: string, user: unknown = ADMIN) {
  const fastify = Fastify();
  fastify.addHook("onRequest", async (request) => {
    (request as unknown as { user: unknown }).user = user;
    bindRequestTenant("demo");
  });
  void fastify.register(plugin, { prefix });
  return fastify;
}

function queuedJob(id: string, moduleId: string) {
  return {
    id,
    moduleId,
    kind: "import",
    status: "running",
    label: "Importing…",
    createdAt: new Date().toISOString(),
  };
}

/** Sends the request with the tenant context bound by the onRequest hook. */
function post(fastify: FastifyInstance, url: string, payload: Record<string, unknown>) {
  return fastify.inject({ method: "POST", url, payload });
}

describe("faculty member import queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserBackgroundJob.mockResolvedValue(null);
    mocks.recordModernAuditEvent.mockResolvedValue(undefined);
  });

  it("appends one queue-level `faculty.import` audit row with the actor and row count", async () => {
    mocks.enqueueBackgroundJob.mockResolvedValue(queuedJob("job-1", "faculty"));
    const fastify = buildApp(facultyImportRoutes, "/api/faculty");

    const res = await post(fastify, "/api/faculty/import", {
      rows: [{ employeeId: "EMP-1" }, { employeeId: "EMP-2" }],
    });

    expect(res.statusCode).toBe(202);
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "faculty",
        recordId: "job-1",
        realUserId: "7",
        newState: expect.objectContaining({
          action: "faculty.import",
          summary: "Queued faculty import (2 rows)",
        }),
      }),
    );
  });

  it("does not append a second audit row when the idempotency key replays an existing job", async () => {
    mocks.getUserBackgroundJob.mockResolvedValue(queuedJob("job-existing", "faculty"));
    const fastify = buildApp(facultyImportRoutes, "/api/faculty");

    const res = await post(fastify, "/api/faculty/import", {
      rows: [{ employeeId: "EMP-1" }],
      idempotencyKey: "idem-key-0001",
    });

    expect(res.statusCode).toBe(202);
    expect(mocks.enqueueBackgroundJob).not.toHaveBeenCalled();
    expect(mocks.recordModernAuditEvent).not.toHaveBeenCalled();
  });

  it("keeps the existing write-permission gate", async () => {
    const fastify = buildApp(facultyImportRoutes, "/api/faculty", {
      id: 9,
      role: "viewer",
      email: "viewer@test.com",
    });

    const res = await post(fastify, "/api/faculty/import", { rows: [{ employeeId: "EMP-1" }] });

    expect(res.statusCode).toBe(403);
    expect(mocks.recordModernAuditEvent).not.toHaveBeenCalled();
  });
});

describe("faculty catalog import queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserBackgroundJob.mockResolvedValue(null);
    mocks.recordModernAuditEvent.mockResolvedValue(undefined);
    mocks.enqueueBackgroundJob.mockImplementation((_tenant: string, _user: string, job) =>
      Promise.resolve(job),
    );
  });

  it("audits department imports as `faculty.departments.import`", async () => {
    const fastify = buildApp(facultyCatalogIoRoutes, "/api/faculty");

    const res = await post(fastify, "/api/faculty/departments/import", {
      rows: [{ name: "Hifz" }],
    });

    expect(res.statusCode).toBe(202);
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "faculty-departments",
        newState: expect.objectContaining({ action: "faculty.departments.import" }),
      }),
    );
  });

  it("audits designation imports as `faculty.designations.import`", async () => {
    const fastify = buildApp(facultyCatalogIoRoutes, "/api/faculty");

    const res = await post(fastify, "/api/faculty/designations/import", {
      rows: [{ department: "Hifz", name: "Mudarris" }],
    });

    expect(res.statusCode).toBe(202);
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "faculty-designations",
        newState: expect.objectContaining({ action: "faculty.designations.import" }),
      }),
    );
  });
});
