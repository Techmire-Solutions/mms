import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RedisUnavailableError } from "../lib/redis.js";

const mocks = vi.hoisted(() => ({ checkBatch: vi.fn() }));

vi.mock("../services/authSessionService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/authSessionService.js")>();
  return { ...actual, checkTenantAuthPipelineBatch: mocks.checkBatch };
});

import { authenticateTenant } from "../middleware/authenticate.js";

const JWT_SECRET = "test-secret-at-least-32-characters-long";

async function buildProbeApp() {
  const app = Fastify();
  await app.register(jwt, { secret: JWT_SECRET });
  app.get("/probe", { preHandler: authenticateTenant }, async () => ({ ok: true }));
  return app;
}

function accessToken(app: Awaited<ReturnType<typeof buildProbeApp>>): string {
  return app.jwt.sign({
    id: "u-1",
    workspaceSubdomain: "demo",
    role: "admin",
    jti: "j-1",
    tokenType: "access",
    twoFactorVerified: true,
    iat_ms: Date.now(),
  });
}

describe("tenant auth dependency failure", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a retryable 503 when the revocation store is unavailable", async () => {
    mocks.checkBatch.mockRejectedValue(new RedisUnavailableError());
    const app = await buildProbeApp();

    const res = await app.inject({
      method: "GET",
      url: "/probe",
      headers: { host: "demo.localhost", authorization: `Bearer ${accessToken(app)}` },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ type: "service_unavailable" });
    await app.close();
  });

  it("does not mask an unexpected error as a dependency failure", async () => {
    mocks.checkBatch.mockRejectedValue(new Error("boom"));
    const app = await buildProbeApp();

    const res = await app.inject({
      method: "GET",
      url: "/probe",
      headers: { host: "demo.localhost", authorization: `Bearer ${accessToken(app)}` },
    });

    expect(res.statusCode).toBe(500);
    await app.close();
  });
});
