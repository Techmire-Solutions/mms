import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
  getPoolMetrics: vi.fn().mockReturnValue({ totalCount: 1, idleCount: 1, waitingCount: 0 }),
}));

import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const EXTERNAL = "203.0.113.9";
const LOOPBACK = "127.0.0.1";

describe("metrics endpoint exposure", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed for a non-loopback scrape when no token is configured", async () => {
    vi.stubEnv("METRICS_ENABLED", "true");
    vi.stubEnv("METRICS_TOKEN", "");

    const res = await app.inject({
      method: "GET",
      url: "/metrics",
      remoteAddress: EXTERNAL,
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toBe("Bearer");
  });

  it("allows a loopback scrape without a token", async () => {
    vi.stubEnv("METRICS_ENABLED", "true");
    vi.stubEnv("METRICS_TOKEN", "");

    const res = await app.inject({
      method: "GET",
      url: "/metrics",
      remoteAddress: LOOPBACK,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("mms_");
  });

  it("requires the configured bearer token from a non-loopback scrape", async () => {
    vi.stubEnv("METRICS_ENABLED", "true");
    vi.stubEnv("METRICS_TOKEN", "scrape-secret");

    const missing = await app.inject({
      method: "GET",
      url: "/metrics",
      remoteAddress: EXTERNAL,
    });
    expect(missing.statusCode).toBe(401);

    const wrong = await app.inject({
      method: "GET",
      url: "/metrics",
      remoteAddress: EXTERNAL,
      headers: { authorization: "Bearer wrong" },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await app.inject({
      method: "GET",
      url: "/metrics",
      remoteAddress: EXTERNAL,
      headers: { authorization: "Bearer scrape-secret" },
    });
    expect(ok.statusCode).toBe(200);
  });

  it("stays hidden when the endpoint is disabled", async () => {
    vi.stubEnv("METRICS_ENABLED", "false");

    const res = await app.inject({
      method: "GET",
      url: "/metrics",
      remoteAddress: LOOPBACK,
    });

    expect(res.statusCode).toBe(404);
  });
});
