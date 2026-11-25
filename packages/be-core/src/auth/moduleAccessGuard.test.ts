import { describe, expect, it } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ModuleAvailabilityMap } from "@mms/contracts";
import { createModuleAccessGuard } from "./moduleAccessGuard.js";

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

const availability = {} as ModuleAvailabilityMap;

function guard() {
  return createModuleAccessGuard({
    loadAvailability: async () => availability,
    resolveRole: async () => "admin",
    resolveAction: () => "read",
    markStage: () => undefined,
  });
}

describe("createModuleAccessGuard", () => {
  it("denies a request with no stamped module config", async () => {
    const request = {
      routeOptions: { config: {} },
      user: { id: "u-1", role: "admin" },
    } as unknown as FastifyRequest;
    const reply = makeReply();
    await guard().moduleAccessGuard(request, reply as unknown as FastifyReply);
    expect(reply.statusCode).toBe(403);
    expect(reply.body).toMatchObject({ code: "MODULE_ACCESS_UNAVAILABLE" });
  });

  it("fails closed when availability cannot be loaded", async () => {
    const request = {
      routeOptions: { config: { moduleAccess: { moduleId: "students", action: "read" } } },
      headers: {},
      user: { id: "u-1", role: "admin" },
      tenant: { id: "acme" },
    } as unknown as FastifyRequest;
    const reply = makeReply();
    const g = createModuleAccessGuard({
      loadAvailability: async () => {
        throw new Error("db down");
      },
      resolveRole: async () => "admin",
      resolveAction: () => "read",
    });
    await g.moduleAccessGuard(request, reply as unknown as FastifyReply);
    expect(reply.statusCode).toBe(403);
    expect(reply.body).toMatchObject({ code: "MODULE_ACCESS_UNAVAILABLE" });
  });

  it("returns denial bodies for in-handler checks", async () => {
    const request = {
      headers: {},
      user: { id: "u-1", role: "admin" },
      tenant: { id: "acme" },
    } as unknown as FastifyRequest;
    const g = createModuleAccessGuard({
      loadAvailability: async () => availability,
      resolveRole: async () => "admin",
      resolveAction: () => "read",
    });
    const denial = await g.getDenial(request, "students", "read");
    expect(denial?.type).toBe("forbidden");
    expect(denial?.moduleId).toBe("students");
  });
});
