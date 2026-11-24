import { describe, expect, it, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { PlatformUser } from "@mms/contracts";
import { createPlatformAdminGuard, platformSessionScope } from "./platformAdminGuard.js";

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

const PLATFORM_USER = { id: "p-1", role: "super_user" } as unknown as PlatformUser;

const ports = () => ({
  resolveUser: async () => ({ ok: true as const, user: PLATFORM_USER }),
  sessionPolicy: () => ({ idleMs: 60_000, absoluteMs: 600_000, warnBeforeMs: 0 }),
  sessionScope: platformSessionScope,
  enforceSessionClock: async () => "ok" as const,
  isDependencyUnavailable: () => false,
});

describe("createPlatformAdminGuard", () => {
  it("binds the platform user on the apex", async () => {
    const request = { headers: {}, user: {}, log: { error: vi.fn() } } as unknown as FastifyRequest;
    const reply = makeReply();
    await createPlatformAdminGuard(ports()).authenticate(request, reply as unknown as FastifyReply);
    expect((request as unknown as { platformUser: PlatformUser }).platformUser).toBe(PLATFORM_USER);
  });

  it("maps resolution failures to 401 envelopes", async () => {
    const guard = createPlatformAdminGuard({
      ...ports(),
      resolveUser: async () => ({ ok: false, reason: "session_revoked" }),
    });
    const reply = makeReply();
    await guard.authenticate({ headers: {} } as FastifyRequest, reply as unknown as FastifyReply);
    expect(reply.statusCode).toBe(401);
    expect(reply.body).toMatchObject({ type: "session_revoked" });
  });

  it("maps dependency outages to retryable 503", async () => {
    const guard = createPlatformAdminGuard({
      ...ports(),
      resolveUser: async () => ({ ok: false, reason: "dependency_unavailable" }),
    });
    const reply = makeReply();
    await guard.authenticate({ headers: {} } as FastifyRequest, reply as unknown as FastifyReply);
    expect(reply.statusCode).toBe(503);
  });

  it("optional probe never writes 401", async () => {
    const guard = createPlatformAdminGuard({
      ...ports(),
      resolveUser: async () => ({ ok: false, reason: "auth_required" }),
    });
    const request = { headers: {} } as FastifyRequest;
    const reply = makeReply();
    await guard.optionalAuthenticate(request, reply as unknown as FastifyReply);
    expect(reply.sent).toBe(false);
    expect((request as unknown as { platformUser?: PlatformUser }).platformUser).toBeUndefined();
  });

  it("enforces super-user and grantable permissions", async () => {
    const guard = createPlatformAdminGuard(ports());
    const denied = makeReply();
    await guard.requireSuperUser()(
      { headers: {}, platformUser: { role: "admin" } } as unknown as FastifyRequest,
      denied as unknown as FastifyReply,
    );
    expect(denied.statusCode).toBe(403);

    const allowed = makeReply();
    await guard.requirePermission("workspaces")(
      { headers: {}, platformUser: PLATFORM_USER } as unknown as FastifyRequest,
      allowed as unknown as FastifyReply,
    );
    expect(allowed.sent).toBe(false);
  });
});
