import { describe, expect, it, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { RedisUnavailableError } from "../lib/authRedisReads.js";
import {
  enforceSessionClockOrReply,
  isAuthDependencyUnavailable,
  rejectOnAuthDependencyFailure,
  verifyJwtOrUnauthorized,
} from "../lib/authGuard.js";

function mockReply() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply & {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

function mockRequest() {
  return {} as unknown as FastifyRequest;
}

describe("isAuthDependencyUnavailable / rejectOnAuthDependencyFailure", () => {
  it("recognizes the Redis-unavailable signal", () => {
    expect(isAuthDependencyUnavailable(new RedisUnavailableError())).toBe(true);
    expect(isAuthDependencyUnavailable(new Error("boom"))).toBe(false);
  });

  it("writes the tenant 503 for a dependency failure", async () => {
    const reply = mockReply();
    const handled = await rejectOnAuthDependencyFailure(
      reply,
      new RedisUnavailableError(),
      "tenant",
    );
    expect(handled).toBe(true);
    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({
      type: "service_unavailable",
      message: "Session validation is temporarily unavailable. Please retry.",
    });
  });

  it("writes the platform 503 for a dependency failure", async () => {
    const reply = mockReply();
    const handled = await rejectOnAuthDependencyFailure(
      reply,
      new RedisUnavailableError(),
      "platform",
    );
    expect(handled).toBe(true);
    expect(reply.send).toHaveBeenCalledWith({
      type: "service_unavailable",
      message: "Platform session validation is temporarily unavailable. Please retry.",
    });
  });

  it("does not mask an unexpected error", async () => {
    const reply = mockReply();
    const handled = await rejectOnAuthDependencyFailure(reply, new Error("boom"), "tenant");
    expect(handled).toBe(false);
    expect(reply.status).not.toHaveBeenCalled();
  });
});

describe("verifyJwtOrUnauthorized", () => {
  it("returns true when JWT verification succeeds", async () => {
    const request = {
      jwtVerify: vi.fn().mockResolvedValue(undefined),
    } as unknown as FastifyRequest;
    await expect(verifyJwtOrUnauthorized(request, mockReply())).resolves.toBe(true);
  });

  it("writes a 401 when JWT verification fails", async () => {
    const request = {
      jwtVerify: vi.fn().mockRejectedValue(new Error("invalid token")),
    } as unknown as FastifyRequest;
    const reply = mockReply();
    await expect(verifyJwtOrUnauthorized(request, reply)).resolves.toBe(false);
    expect(reply.status).toHaveBeenCalledWith(401);
  });
});

describe("enforceSessionClockOrReply", () => {
  const policy = { idleMs: 60_000, absoluteMs: null, warnBeforeMs: 0 };

  it("returns true for the ok outcome", async () => {
    const enforce = vi.fn().mockResolvedValue("ok");
    await expect(
      enforceSessionClockOrReply(mockRequest(), mockReply(), {
        scope: "tn:demo:u1",
        policy,
        enforce,
        domain: "tenant",
      }),
    ).resolves.toBe(true);
    expect(enforce).toHaveBeenCalledWith(expect.objectContaining({ scope: "tn:demo:u1", policy }));
  });

  it("maps idle_expired to the shared 401 envelope", async () => {
    const reply = mockReply();
    await expect(
      enforceSessionClockOrReply(mockRequest(), reply, {
        scope: "plat:u1",
        policy,
        enforce: vi.fn().mockResolvedValue("idle_expired"),
        domain: "platform",
      }),
    ).resolves.toBe(false);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      type: "session_idle_expired",
      message: "Session expired due to inactivity",
    });
  });

  it("maps absolute_expired to the shared 401 envelope", async () => {
    const reply = mockReply();
    await expect(
      enforceSessionClockOrReply(mockRequest(), reply, {
        scope: "tn:demo:u1",
        policy,
        enforce: vi.fn().mockResolvedValue("absolute_expired"),
        domain: "tenant",
      }),
    ).resolves.toBe(false);
    expect(reply.send).toHaveBeenCalledWith({
      type: "session_absolute_expired",
      message: "Session reached its maximum duration",
    });
  });

  it("forwards the tenant userId and jti into the enforcement check", async () => {
    const enforce = vi.fn().mockResolvedValue("ok");
    await enforceSessionClockOrReply(mockRequest(), mockReply(), {
      scope: "tn:demo:u1",
      policy,
      jti: "j-1",
      userId: "u1",
      enforce,
      domain: "tenant",
    });
    expect(enforce).toHaveBeenCalledWith(expect.objectContaining({ jti: "j-1", userId: "u1" }));
  });

  it("rejects a dependency outage with the console-specific 503", async () => {
    const reply = mockReply();
    await expect(
      enforceSessionClockOrReply(mockRequest(), reply, {
        scope: "plat:u1",
        policy,
        enforce: vi.fn().mockRejectedValue(new RedisUnavailableError()),
        domain: "platform",
      }),
    ).resolves.toBe(false);
    expect(reply.status).toHaveBeenCalledWith(503);
  });

  it("rethrows unexpected enforcement errors", async () => {
    await expect(
      enforceSessionClockOrReply(mockRequest(), mockReply(), {
        scope: "tn:demo:u1",
        policy,
        enforce: vi.fn().mockRejectedValue(new Error("boom")),
        domain: "tenant",
      }),
    ).rejects.toThrow("boom");
  });
});
