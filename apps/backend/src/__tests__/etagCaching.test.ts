import { describe, it, expect } from "vitest";
import fastify from "fastify";
import { registerHttpPlugins } from "../plugins/http.js";
import type { ServerConfig } from "../config/serverConfig.js";

describe("HTTP ETag & 304 Not Modified (RFC 7232)", () => {
  const dummyConfig = {
    port: 5002,
    host: "127.0.0.1",
    logLevel: "silent",
    isProd: false,
    jwtSecret: "test-secret-at-least-32-chars-long-1234567890",
    databaseUrl: "postgresql://dummy:dummy@localhost:5432/mms_test",
    readReplicaDatabaseUrl: "postgresql://dummy:dummy@localhost:5432/mms_test",
    allowedOrigin: "http://localhost:3000",
    trustProxy: false,
    bodyLimit: 1048576,
    requestTimeoutMs: 30000,
    pgPoolMax: 20,
    pgStatementTimeoutMs: 25000,
    pgIdleInTxTimeoutMs: 10000,
    keepAliveTimeoutMs: 30000,
    headersTimeoutMs: 35000,
    tcpKeepAliveInitialDelayMs: 10000,
  } satisfies ServerConfig;

  async function createTestApp() {
    const app = fastify({ logger: false });
    await registerHttpPlugins(app, dummyConfig);
    app.get("/api/test-data", async () => {
      return { message: "hello world", items: [1, 2, 3] };
    });
    app.get("/api/tenant/lookups", async () => {
      return { categories: ["A", "B"], statuses: ["active", "archived"] };
    });
    return app;
  }

  it("generates weak ETag, Vary isolation, and strict no-store Cache-Control on dynamic GET", async () => {
    const app = await createTestApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/test-data",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers.etag).toMatch(/^W\/"[a-f0-9]{27}"$/);
    expect(res.headers["cache-control"]).toBe("private, no-cache, no-store, must-revalidate");
    expect(res.headers.vary).toBe("Accept-Encoding, X-Tenant-Id, Authorization");
    expect(res.json()).toEqual({ message: "hello world", items: [1, 2, 3] });
  });

  it("generates private, no-cache for tenant cacheable metadata endpoints (lookups, setup)", async () => {
    const app = await createTestApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/lookups",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-cache");
    expect(res.headers.etag).toBeDefined();
    expect(res.headers.vary).toBe("Accept-Encoding, X-Tenant-Id, Authorization");
  });

  it("generates tenant-salted ETags when tenant identity is present", async () => {
    const app = await createTestApp();
    const resTenantAlpha = await app.inject({
      method: "GET",
      url: "/api/tenant/lookups",
      headers: {
        "x-tenant-id": "alpha",
      },
    });

    const resTenantBeta = await app.inject({
      method: "GET",
      url: "/api/tenant/lookups",
      headers: {
        "x-tenant-id": "beta",
      },
    });

    expect(resTenantAlpha.headers.etag).toMatch(/^W\/"alpha-[a-f0-9]{27}"$/);
    expect(resTenantBeta.headers.etag).toMatch(/^W\/"beta-[a-f0-9]{27}"$/);
    expect(resTenantAlpha.headers.etag).not.toBe(resTenantBeta.headers.etag);
  });

  it("returns 304 Not Modified with empty payload when If-None-Match matches tenant ETag", async () => {
    const app = await createTestApp();
    const initial = await app.inject({
      method: "GET",
      url: "/api/tenant/lookups",
      headers: {
        "x-tenant-id": "alpha",
      },
    });

    const etag = initial.headers.etag;
    expect(etag).toBeDefined();

    const cached = await app.inject({
      method: "GET",
      url: "/api/tenant/lookups",
      headers: {
        "x-tenant-id": "alpha",
        "if-none-match": etag as string,
      },
    });

    expect(cached.statusCode).toBe(304);
    expect(cached.headers.etag).toBe(etag);
    expect(cached.body).toBe("");
  });

  it("returns 200 with fresh body when If-None-Match does not match", async () => {
    const app = await createTestApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/test-data",
      headers: {
        "if-none-match": 'W/"stale-etag-999999999999999999999"',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ message: "hello world", items: [1, 2, 3] });
  });

  it("bypasses Fastify compression when x-edge-compression or x-no-compression is present", async () => {
    const app = await createTestApp();
    // Large payload that exceeds 1024 compression threshold
    app.get("/api/large-data", async () => ({
      data: "a".repeat(2048),
    }));

    const resWithEdge = await app.inject({
      method: "GET",
      url: "/api/large-data",
      headers: {
        "accept-encoding": "gzip, deflate, br",
        "x-edge-compression": "brotli,gzip",
      },
    });

    expect(resWithEdge.statusCode).toBe(200);
    expect(resWithEdge.headers["content-encoding"]).toBeUndefined();
  });

  it("correctly generates ETags for Buffer payloads without throwing", async () => {
    const app = await createTestApp();
    app.get("/api/buffer-data", async (_req, reply) => {
      reply.header("content-type", "application/octet-stream");
      return Buffer.from("binary-buffer-payload-test-data");
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/buffer-data",
      headers: { "x-tenant-id": "alpha" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers.etag).toMatch(/^W\/"alpha-[a-f0-9]{27}"$/);
  });

  it("marks /preferences, /setup-config, and /field-config as private, no-cache", async () => {
    const app = await createTestApp();
    app.get("/api/tenant/preferences", async () => ({ theme: "dark" }));
    app.get("/api/tenant/setup-config", async () => ({ configured: true }));
    app.get("/api/tenant/field-config", async () => ({ fields: [] }));

    for (const path of [
      "/api/tenant/preferences",
      "/api/tenant/setup-config",
      "/api/tenant/field-config",
    ]) {
      const res = await app.inject({ method: "GET", url: path });
      expect(res.headers["cache-control"]).toBe("private, no-cache");
    }
  });

  it("salts ETags with x-schema-revision when provided", async () => {
    const app = await createTestApp();
    const resWithoutRev = await app.inject({
      method: "GET",
      url: "/api/tenant/lookups",
      headers: { "x-tenant-id": "alpha" },
    });

    const resWithRev1 = await app.inject({
      method: "GET",
      url: "/api/tenant/lookups",
      headers: {
        "x-tenant-id": "alpha",
        "x-schema-revision": "42",
      },
    });

    const resWithRev2 = await app.inject({
      method: "GET",
      url: "/api/tenant/lookups",
      headers: {
        "x-tenant-id": "alpha",
        "x-schema-revision": "43",
      },
    });

    expect(resWithoutRev.headers.etag).toMatch(/^W\/"alpha-[a-f0-9]{27}"$/);
    expect(resWithRev1.headers.etag).toMatch(/^W\/"alpha-r42-[a-f0-9]{27}"$/);
    expect(resWithRev2.headers.etag).toMatch(/^W\/"alpha-r43-[a-f0-9]{27}"$/);
    expect(resWithRev1.headers.etag).not.toBe(resWithRev2.headers.etag);

    // Conditional 304 matches with revision-salted ETag
    const res304 = await app.inject({
      method: "GET",
      url: "/api/tenant/lookups",
      headers: {
        "x-tenant-id": "alpha",
        "x-schema-revision": "42",
        "if-none-match": resWithRev1.headers.etag as string,
      },
    });
    expect(res304.statusCode).toBe(304);
    expect(res304.body).toBe("");
  });

  it("configures server keepAliveTimeout and headersTimeout on app ready", async () => {
    const app = await createTestApp();
    await app.ready();

    if (app.server) {
      expect(app.server.keepAliveTimeout).toBe(dummyConfig.keepAliveTimeoutMs || 30000);
      expect(app.server.headersTimeout).toBe(dummyConfig.headersTimeoutMs || 35000);
    }
  });

  it("wires TCP keep-alive and TCP no-delay on accepted client sockets in onReady", async () => {
    const app = await createTestApp();
    await app.ready();

    if (app.server) {
      expect(app.server.listenerCount("connection")).toBeGreaterThan(0);
      let keepAliveEnabled = false;
      let initialDelay = 0;
      let noDelayEnabled = false;
      const fakeSocket = {
        setKeepAlive: (enable: boolean, delay: number) => {
          keepAliveEnabled = enable;
          initialDelay = delay;
        },
        setNoDelay: (enable: boolean) => {
          noDelayEnabled = enable;
        },
        on: () => fakeSocket,
        once: () => fakeSocket,
        removeListener: () => fakeSocket,
        emit: () => false,
      };
      app.server.emit("connection", fakeSocket);
      expect(keepAliveEnabled).toBe(true);
      expect(initialDelay).toBe(dummyConfig.tcpKeepAliveInitialDelayMs);
      expect(noDelayEnabled).toBe(true);
    }
  });
});
