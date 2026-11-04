/**
 * Faculty export routes.
 *
 * The queue path (`POST /export/csv`) writes the authoritative audit row, so the
 * legacy client-reportable `/export-audit` endpoint must not be registered: it
 * lets any reader forge export volume (contacts C-09 parity).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

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
  mapActionStringToAuditType: vi.fn(() => "EXPORT"),
}));

import { bindRequestTenant } from "../lib/tenantContext.js";
import { facultyExportRoutes } from "../routes/tenant/faculty/facultyExportRoutes.js";

const ADMIN = { id: 7, role: "admin", email: "admin@test.com" };

function buildApp() {
  const fastify = Fastify();
  fastify.addHook("onRequest", async (request) => {
    (request as unknown as { user: unknown }).user = ADMIN;
    bindRequestTenant("demo");
  });
  void fastify.register(facultyExportRoutes, { prefix: "/api/faculty" });
  return fastify;
}

describe("faculty export routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserBackgroundJob.mockResolvedValue(null);
    mocks.recordModernAuditEvent.mockResolvedValue(undefined);
    mocks.enqueueBackgroundJob.mockImplementation((_t: string, _u: string, job) =>
      Promise.resolve(job),
    );
  });

  it("no longer serves the client-forgeable `/export-audit` endpoint", async () => {
    const fastify = buildApp();

    const res = await fastify.inject({
      method: "POST",
      url: "/api/faculty/export-audit",
      payload: { count: 999, scope: "all" },
    });

    expect(res.statusCode).toBe(404);
    expect(mocks.recordModernAuditEvent).not.toHaveBeenCalled();
  });

  it("keeps the authoritative queue-time export audit row", async () => {
    const fastify = buildApp();

    const res = await fastify.inject({
      method: "POST",
      url: "/api/faculty/export/csv",
      payload: { query: {} },
    });

    expect(res.statusCode).toBe(202);
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "faculty",
        newState: expect.objectContaining({ action: "faculty.export.queue" }),
      }),
    );
  });
});
