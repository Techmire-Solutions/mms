import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";

const matrix = vi.hoisted(() => ({
  value: { u1: { role: "teacher" } } as Record<string, { role: string; deletedAt?: unknown }>,
}));

vi.mock("@mms/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/shared")>();
  return { ...actual, isWorkspaceEnabled: () => true };
});

vi.mock("../lib/requestDiagnostics.js", () => ({ markRequestDiagnosticStage: vi.fn() }));
vi.mock("../services/sessionClockService.js", () => ({ tenantSessionScope: () => "scope" }));
vi.mock("../services/sessionGuardService.js", () => ({
  enforceTenantSessionClock: vi.fn().mockResolvedValue("ok"),
  SESSION_EXPIRY_RESPONSE: {},
}));
vi.mock("../services/sessionPolicyService.js", () => ({ tenantSessionPolicy: () => ({}) }));
vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
  bindRequestTenant: vi.fn(),
  bindRequestUserId: vi.fn(),
  bindRequestAuditContext: vi.fn(),
  resolveSubdomainFromRequest: vi.fn(),
}));
vi.mock("../config/telemetry.js", () => ({ formatTraceParent: () => null }));
vi.mock("../services/workspaceService.js", () => ({
  getWorkspaceBySubdomain: vi.fn().mockResolvedValue({ subdomain: "demo", status: "active" }),
}));
vi.mock("../services/globalSettingsService.js", () => ({
  loadGlobalSettings: vi.fn().mockResolvedValue({ sessionTimeout: "30" }),
}));
vi.mock("../lib/httpErrors.js", () => ({
  sendForbidden: vi.fn(),
  sendUnauthorized: vi.fn(),
}));
vi.mock("../services/session.service.js", () => ({
  checkTenantAuthPipelineBatch: vi.fn().mockResolvedValue({
    tenantBlocked: false,
    tokenRevoked: false,
    userSessionRevoked: false,
    globalSettingsCached: null,
    workspaceCached: null,
  }),
}));
vi.mock("../services/rbacService.js", () => ({
  getTenantRoleMatrix: vi.fn(async () => matrix.value),
}));

import { authenticateTenant } from "../middleware/authenticate.js";
import { sendUnauthorized } from "../lib/httpErrors.js";

function makeReply(): FastifyReply {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    sent: false,
  } as unknown as FastifyReply;
}

function makeRequest(role: string): FastifyRequest {
  const request = {
    user: { id: "u1", role, workspaceSubdomain: "demo" },
    headers: {},
    ip: "127.0.0.1",
    method: "GET",
    url: "/api/email/integration",
    log: { error: vi.fn() },
    jwtVerify: vi.fn().mockResolvedValue(undefined),
  };
  return request as unknown as FastifyRequest;
}

describe("authenticateTenant fresh role", () => {
  beforeEach(() => {
    matrix.value = { u1: { role: "teacher" } };
  });

  it("replaces the stale JWT role with the current matrix role", async () => {
    const request = makeRequest("admin"); // token still claims admin
    const reply = makeReply();

    await authenticateTenant(request, reply);

    expect((request.user as { role: string }).role).toBe("teacher");
    expect(sendUnauthorized).not.toHaveBeenCalled();
  });

  it("rejects a user removed from the matrix", async () => {
    matrix.value = {};
    const request = makeRequest("admin");
    const reply = makeReply();

    await authenticateTenant(request, reply);

    expect(sendUnauthorized).toHaveBeenCalled();
  });
});
