import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Mutable role for the mocked authenticateTenant hook. */
const authState = vi.hoisted(() => ({ role: "admin" }));

vi.mock("../middleware/authenticate.js", () => ({
  authenticateTenant: vi.fn(async (request: FastifyRequest) => {
    const req = request as FastifyRequest & {
      user?: { id: string; role: string; workspaceSubdomain: string };
    };
    req.user = { id: "u1", role: authState.role, workspaceSubdomain: "demo" };
  }),
}));

import aiRoutes from "../routes/common/ai.js";

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(aiRoutes, { prefix: "/api/ai" });
  await app.ready();
  return app;
}

describe("/api/ai access control", () => {
  beforeEach(() => {
    authState.role = "admin";
  });

  it("allows super_admin (previously denied by the raw role !== 'admin' check)", async () => {
    authState.role = "super_admin";
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/models",
      payload: { provider: "gemini" },
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, models: [] });
  });

  it("allows admin", async () => {
    authState.role = "admin";
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/models",
      payload: { provider: "gemini" },
    });
    await app.close();

    expect(res.statusCode).toBe(200);
  });

  it("denies a teacher without settings.global.write", async () => {
    authState.role = "teacher";
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/models",
      payload: { provider: "gemini" },
    });
    await app.close();

    expect(res.statusCode).toBe(403);
  });
});
