import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  getPoolMetrics: vi.fn().mockReturnValue({ totalCount: 5, idleCount: 4, waitingCount: 0 }),
}));

import { pingDatabase } from "../db/database.js";
import { buildApp } from "../app.js";

describe("health routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.mocked(pingDatabase).mockResolvedValue(true);
    delete process.env.METRICS_TOKEN;
  });

  it("GET /health returns OK and pool metrics", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: "OK",
      pool: { totalCount: 5, idleCount: 4, waitingCount: 0 },
    });
    await app.close();
  });

  it("GET /health hides pool/cache topology from non-loopback callers", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/health",
      remoteAddress: "203.0.113.9",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("OK");
    expect(typeof body.timestamp).toBe("string");
    expect(body).not.toHaveProperty("pool");
    expect(body).not.toHaveProperty("redis");
    expect(body).not.toHaveProperty("cache");
    await app.close();
  });

  it("GET /health keeps detail for a valid METRICS_TOKEN bearer only", async () => {
    process.env.METRICS_TOKEN = "metrics-secret";
    const app = await buildApp();

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/health",
      remoteAddress: "203.0.113.9",
    });
    expect(unauthenticated.json()).not.toHaveProperty("pool");

    const wrongToken = await app.inject({
      method: "GET",
      url: "/health",
      remoteAddress: "203.0.113.9",
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(wrongToken.json()).not.toHaveProperty("pool");

    const authorized = await app.inject({
      method: "GET",
      url: "/health",
      remoteAddress: "203.0.113.9",
      headers: { authorization: "Bearer metrics-secret" },
    });
    expect(authorized.json()).toMatchObject({
      status: "OK",
      pool: { totalCount: 5, idleCount: 4, waitingCount: 0 },
    });
    await app.close();
  });

  it("GET /ready returns ready when database is connected", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ready", database: "connected" });
    await app.close();
  });

  it("GET /ready returns 503 when database is down", async () => {
    vi.mocked(pingDatabase).mockResolvedValueOnce(false);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: "not_ready", database: "disconnected" });
    await app.close();
  });

  /**
   * Guards the OpenAPI document's STRUCTURE.
   *
   * KNOWN LIMITATION (verified, tracked here so it is not forgotten):
   * the generated document lists paths, operations and parameter NAMES, but
   * every `schema` is empty `{}` — no types, no enums, no defaults. It is not
   * usable for client generation.
   *
   * Cause: this workspace is on Zod 4 (`catalog: zod ^4.4.3`), while
   * `@ts-rest/open-api` — including its newest prereleases — declares
   * `peerDependencies: { zod: '^3.22.3' }` and delegates introspection to
   * `@anatine/zod-openapi@1.x`, which only understands the Zod 3 schema API.
   * Replacing it with the Zod-4-native `@asteasolutions/zod-to-openapi` was
   * prototyped and works for bodies/responses, but parameter metadata could not
   * be attached: the schemas built by `@mms/shared` do not receive
   * `extendZodWithOpenApi`'s prototype patch (`schema.openapi` is undefined even
   * though `z.string().openapi` is a function in the same process), so
   * `registerPath` throws "Missing parameter data".
   *
   * Do not "fix" this by overriding `ts-deepmerge` to >=8 either: that breaks
   * generation outright (v8's CJS build no longer exports `.default()`, which
   * `@anatine/zod-openapi` calls). The ts-deepmerge advisory is therefore a
   * documented exception — see the `overrides` block in pnpm-workspace.yaml.
   *
   * When the parameter-metadata issue is resolved, tighten this test to assert
   * real schemas (e.g. that a query parameter's schema has a `type`).
   */
  it("GET /api/openapi.json returns a structurally valid OpenAPI document", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/openapi.json" });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(typeof json.openapi).toBe("string");
    expect(json.openapi).toMatch(/^3\./);
    expect(json.info.title).toBe("MMS API");
    expect(typeof json.paths).toBe("object");
    expect(Object.keys(json.paths).length).toBeGreaterThan(0);
    // Paths carry operations and named parameters (types are the known gap above).
    const students = json.paths["/api/students"]?.get;
    expect(students).toBeDefined();
    expect(Array.isArray(students.parameters)).toBe(true);
    expect(students.parameters.length).toBeGreaterThan(0);
    expect(students.parameters[0].name).toBe("page");
    await app.close();
  });
});
