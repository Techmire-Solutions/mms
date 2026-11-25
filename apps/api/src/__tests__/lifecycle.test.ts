import fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/database.js", () => ({
  pingDatabase: vi.fn().mockResolvedValue(true),
  getPoolMetrics: vi.fn().mockReturnValue({ totalCount: 1, idleCount: 1, waitingCount: 0 }),
  initDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/redis.js", () => ({
  checkIsRedisConnected: () => true,
}));

import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import healthRoutes from "../routes/common/health.js";
import {
  isShuttingDown,
  markShuttingDown,
  resetLifecycleStateForTesting,
  waitForDrain,
} from "../lib/lifecycle.js";

describe("lifecycle-aware readiness", () => {
  const apps: ReturnType<typeof fastify>[] = [];

  beforeEach(() => {
    resetLifecycleStateForTesting();
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    resetLifecycleStateForTesting();
  });

  async function buildHealthApp() {
    const app = fastify({ logger: false });
    apps.push(app);
    // The health routes declare Zod response schemas, so the app needs the
    // same compilers the real bootstrap installs.
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(healthRoutes);
    return app;
  }

  it("reports ready while running", async () => {
    const app = await buildHealthApp();
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ready");
  });

  /**
   * The property that makes deploys zero-downtime: once shutdown starts, the
   * readiness probe must fail so traffic is routed elsewhere BEFORE the socket
   * closes. `/health` (liveness) deliberately keeps returning 200 — the process
   * is alive and draining, and a liveness failure would trigger a restart.
   */
  it("reports not-ready as soon as shutdown begins", async () => {
    const app = await buildHealthApp();
    markShuttingDown();

    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({ status: "not_ready", database: "draining" });

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
  });

  it("still serves in-flight work while draining", async () => {
    const app = fastify({ logger: false });
    apps.push(app);
    app.get("/api/work", async () => ({ done: true }));

    markShuttingDown();

    // Draining must not reject requests the balancer already routed here.
    const res = await app.inject({ method: "GET", url: "/api/work" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ done: true });
  });
});

describe("shutdown drain helpers", () => {
  afterEach(() => {
    resetLifecycleStateForTesting();
  });

  it("tracks the shutting-down flag idempotently", () => {
    expect(isShuttingDown()).toBe(false);
    markShuttingDown();
    markShuttingDown();
    expect(isShuttingDown()).toBe(true);
    resetLifecycleStateForTesting();
    expect(isShuttingDown()).toBe(false);
  });

  it("resolves immediately for a zero or negative wait", async () => {
    await expect(waitForDrain(0)).resolves.toBeUndefined();
    await expect(waitForDrain(-1)).resolves.toBeUndefined();
  });

  it("actually waits for a positive delay", async () => {
    const started = Date.now();
    await waitForDrain(30);
    expect(Date.now() - started).toBeGreaterThanOrEqual(20);
  });
});
