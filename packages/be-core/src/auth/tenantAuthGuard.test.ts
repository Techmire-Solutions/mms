import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { GlobalSettings, User } from "@mms/contracts";
import {
  createTenantAuthGuard,
  type TenantAuthPipelineSnapshot,
  type TenantAuthSessionPorts,
} from "./tenantAuthGuard.js";

interface FakeReply {
  sent: boolean;
  statusCode: number;
  body: unknown;
  status(code: number): FakeReply;
  send(body: unknown): FakeReply;
}

function makeReply(): FakeReply {
  const reply: FakeReply = {
    sent: false,
    statusCode: 200,
    body: undefined,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(body: unknown) {
      reply.sent = true;
      reply.body = body;
      return reply;
    },
  };
  return reply;
}

function makeRequest(
  user: User & Record<string, unknown>,
): FastifyRequest & { tenant?: { id: string } } {
  return {
    headers: { host: "acme.example.com" },
    ip: "203.0.113.7",
    url: "/api/students",
    method: "GET",
    user,
    log: { error: vi.fn() },
    jwtVerify: vi.fn(async () => undefined),
  } as unknown as FastifyRequest;
}

const USER = {
  id: "u-1",
  role: "admin",
  workspaceSubdomain: "acme",
} as unknown as User & Record<string, unknown>;

const SETTINGS = { sessionTimeout: "60" } as unknown as GlobalSettings;

type Ports = TenantAuthSessionPorts;
function makePorts(overrides: Partial<Ports> = {}): Ports {
  const pipeline: TenantAuthPipelineSnapshot = {
    tenantBlocked: false,
    tokenRevoked: false,
    userSessionRevoked: false,
  };
  return {
    readAuthPipeline: async () => pipeline,
    isDependencyUnavailable: () => false,
    resolveAuthoritativeRole: async () => ({ role: "admin" }),
    attachRoleCatalog: async () => undefined,
    isAccountSoftDeleted: async () => false,
    loadGlobalSettings: async () => SETTINGS,
    sessionPolicyFor: () => ({ idleMs: 60_000, absoluteMs: 600_000, warnBeforeMs: 0 }),
    enforceSessionClock: async () => "ok",
    loadWorkspace: async () => ({ enabled: true }) as never,
    markStage: () => undefined,
    onUnexpectedError: () => undefined,
    ...overrides,
  };
}

function run(ports: Ports, request = makeRequest(USER)) {
  const reply = makeReply();
  const guard = createTenantAuthGuard(ports);
  return guard(request, reply as unknown as FastifyReply).then(() => ({ request, reply }));
}

describe("createTenantAuthGuard", () => {
  beforeEach(() => {
    process.env.MMS_APP_DOMAIN = "example.com";
  });

  it("binds the verified tenant and audit context on success", async () => {
    const { request } = await run(makePorts());
    expect((request as unknown as { tenant?: { id: string } }).tenant).toEqual({ id: "acme" });
  });

  it("rejects a request with no tenant subdomain", async () => {
    const request = makeRequest(USER);
    request.headers.host = "localhost";
    const { reply } = await run(makePorts(), request);
    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({
      type: "forbidden",
      message: "This endpoint requires a tenant subdomain",
    });
  });

  it("fails closed on a workspace blocklist hit", async () => {
    const { reply } = await run(
      makePorts({
        readAuthPipeline: async () => ({
          tenantBlocked: true,
          tokenRevoked: false,
          userSessionRevoked: false,
        }),
      }),
    );
    expect(reply.statusCode).toBe(403);
    expect(reply.body).toMatchObject({ type: "workspace_disabled" });
  });

  it("rejects revoked sessions and deleted accounts", async () => {
    const revoked = await run(
      makePorts({
        readAuthPipeline: async () => ({
          tenantBlocked: false,
          tokenRevoked: true,
          userSessionRevoked: false,
        }),
      }),
    );
    expect(revoked.reply.body).toMatchObject({ type: "auth_required", message: "Session revoked" });

    const deleted = await run(makePorts({ resolveAuthoritativeRole: async () => null }));
    expect(deleted.reply.body).toMatchObject({ message: "Session revoked" });
  });

  it("maps a session-clock expiry to the shared 401 envelope", async () => {
    const { reply } = await run(makePorts({ enforceSessionClock: async () => "idle_expired" }));
    expect(reply.statusCode).toBe(401);
    expect(reply.body).toMatchObject({ type: "session_idle_expired" });
  });

  it("maps an auth dependency outage to a retryable 503", async () => {
    const dependencyError = new Error("redis down");
    const { reply } = await run(
      makePorts({
        readAuthPipeline: async () => {
          throw dependencyError;
        },
        isDependencyUnavailable: (error) => error === dependencyError,
      }),
    );
    expect(reply.statusCode).toBe(503);
    expect(reply.body).toMatchObject({ type: "service_unavailable" });
  });

  it("rejects refresh and platform tokens on tenant routes", async () => {
    const refresh = await run(makePorts(), makeRequest({ ...USER, tokenType: "refresh" } as never));
    expect(refresh.reply.body).toMatchObject({
      message: "Refresh token cannot access this resource",
    });

    const platform = await run(
      makePorts(),
      makeRequest({ ...USER, tokenType: "platform_access" } as never),
    );
    expect(platform.reply.body).toMatchObject({
      message: "Platform session cannot access tenant resources",
    });
  });

  it("requires 2FA and rejects disabled workspaces", async () => {
    const twoFactor = await run(
      makePorts(),
      makeRequest({ ...USER, twoFactorVerified: false } as never),
    );
    expect(twoFactor.reply.body).toMatchObject({ type: "two_factor_required" });

    const disabled = await run(makePorts({ loadWorkspace: async () => null }));
    expect(disabled.reply.body).toMatchObject({ type: "workspace_disabled" });
  });

  it("keeps the token role when the matrix lookup throws in tests", async () => {
    const { reply } = await run(
      makePorts({
        resolveAuthoritativeRole: async () => {
          throw new Error("db unavailable");
        },
      }),
    );
    expect(reply.sent).toBe(false);
  });

  it("does not run when the reply is already sent", async () => {
    const request = makeRequest(USER);
    const reply = makeReply();
    reply.sent = true;
    const guard = createTenantAuthGuard(makePorts());
    await guard(request, reply as unknown as FastifyReply);
    expect(
      (request as unknown as { jwtVerify: () => Promise<void> }).jwtVerify,
    ).not.toHaveBeenCalled();
  });
});
