import { describe, expect, it, beforeEach } from "vitest";
import fastify from "fastify";
import { registerCsrfOriginGuard } from "../plugins/csrfOriginGuard.js";
import type { ServerConfig } from "../config/serverConfig.js";

function createMockConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 3000,
    host: "0.0.0.0",
    isProd: false,
    readReplicaDatabaseUrl: "postgres://localhost",
    databaseUrl: "postgres://localhost/test",
    jwtSecret: "test-secret",
    logLevel: "silent",
    trustProxy: false,
    bodyLimit: 1048576,
    requestTimeoutMs: 30000,
    allowedOrigin: "",
    pgPoolMax: 10,
    pgStatementTimeoutMs: 10000,
    pgIdleInTxTimeoutMs: 5000,
    keepAliveTimeoutMs: 30000,
    headersTimeoutMs: 35000,
    tcpKeepAliveInitialDelayMs: 10000,
    ...overrides,
  };
}

async function buildTestApp(config: ServerConfig) {
  const app = fastify();
  app.addContentTypeParser("multipart/form-data", (_req, _payload, done) => {
    done(null, null);
  });
  registerCsrfOriginGuard(app, config);

  app.get("/api/test", async () => ({ ok: true }));
  app.post("/api/test", async () => ({ ok: true }));
  app.put("/api/test", async () => ({ ok: true }));
  app.delete("/api/test", async () => ({ ok: true }));
  app.post("/uploads/image", async () => ({ uploaded: true }));

  await app.ready();
  return app;
}

describe("CSRF & Origin Gate Guard", () => {
  beforeEach(() => {
    delete process.env.MMS_APP_DOMAIN;
  });

  it("allows safe GET requests from any origin or Sec-Fetch-Site", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "GET",
      url: "/api/test",
      headers: {
        origin: "https://evil.com",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("blocks state-changing requests with Sec-Fetch-Site: cross-site", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Cross-site mutation blocked",
    });
  });

  it("allows mutations with Sec-Fetch-Site: same-origin or same-site", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("blocks mutations with untrusted Origin header", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        host: "demo.localhost:3000",
        origin: "https://attacker.example.com",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Untrusted origin blocked",
    });
  });

  it("allows mutations with matching localhost or trusted workspace origin in dev", async () => {
    const app = await buildTestApp(createMockConfig({ isProd: false }));
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        host: "demo.localhost:3000",
        origin: "http://demo.localhost:5173",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("in production, validates Origin against MMS_APP_DOMAIN", async () => {
    process.env.MMS_APP_DOMAIN = "madrasa.org";
    const app = await buildTestApp(createMockConfig({ isProd: true }));

    // Trusted tenant subdomain origin -> allowed
    const resAllowed = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        host: "demo.madrasa.org",
        origin: "https://demo.madrasa.org",
      },
      payload: { data: "test" },
    });
    expect(resAllowed.statusCode).toBe(200);

    // Untrusted external origin -> blocked
    const resBlocked = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        host: "demo.madrasa.org",
        origin: "https://evil-spoof.com",
      },
      payload: { data: "test" },
    });
    expect(resBlocked.statusCode).toBe(403);
    expect(resBlocked.json()).toMatchObject({
      type: "forbidden",
      message: "Untrusted origin blocked",
    });
  });

  it("blocks mutations with untrusted Referer when Origin is omitted", async () => {
    const app = await buildTestApp(createMockConfig({ isProd: false }));
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        host: "demo.localhost:3000",
        referer: "https://malicious-site.com/steal-data",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Untrusted referer blocked",
    });
  });

  it("rejects non-JSON Content-Type (like text/plain) on API mutations with 415", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "text/plain",
        host: "localhost:3000",
      },
      payload: "invalid-plain-text",
    });
    expect(res.statusCode).toBe(415);
    expect(res.json()).toMatchObject({
      type: "unsupported_media_type",
      message: "Content-Type must be application/json",
    });
  });

  it("rejects a cookie-auth API mutation with a missing X-CSRF-Token header", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        cookie: "csrf_token=valid-token; mms_access=abc",
        origin: "http://localhost:3000",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Invalid or missing CSRF token",
    });
  });

  it("allows a cookie-auth API mutation with a matching X-CSRF-Token header", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        cookie: "csrf_token=valid-token",
        "x-csrf-token": "valid-token",
        origin: "http://localhost:3000",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects a cookie-session API mutation that carries no origin signal and no CSRF token", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        cookie: "mms_access=abc",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Missing origin or CSRF token",
    });
  });

  it("rejects a cookie-session mutation carrying only Sec-Fetch-Site (no Origin/Referer) and no CSRF token", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
        cookie: "mms_access=abc",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Missing origin or CSRF token",
    });
  });

  it("handles array headers safely for Sec-Fetch-Site and Origin", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": ["cross-site", "same-origin"] as unknown as string,
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Cross-site mutation blocked",
    });
  });

  it("supports comma-separated allowedOrigin configurations", async () => {
    const app = await buildTestApp(
      createMockConfig({
        allowedOrigin: "https://mms-app.org, https://admin.mms-app.org",
      }),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        origin: "https://admin.mms-app.org",
        host: "api.mms-app.org",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects unencrypted HTTP origins in production mode", async () => {
    process.env.MMS_APP_DOMAIN = "madrasa.org";
    const app = await buildTestApp(createMockConfig({ isProd: true }));
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        "content-type": "application/json",
        host: "demo.madrasa.org",
        origin: "http://demo.madrasa.org",
      },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      message: "Untrusted origin blocked",
    });
  });

  it("rejects API mutation with body when Content-Type is completely omitted", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: {
        host: "localhost:3000",
        "content-length": "15",
      },
      payload: '{"data":"test"}',
    });
    expect(res.statusCode).toBe(415);
    expect(res.json()).toMatchObject({
      type: "unsupported_media_type",
      message: "Content-Type must be application/json",
    });
  });

  it("allows requests without session cookies (no CSRF/Origin check)", async () => {
    const app = await buildTestApp(createMockConfig());
    const res = await app.inject({
      method: "POST",
      url: "/api/test",
      headers: { "content-type": "application/json" },
      payload: { data: "test" },
    });
    expect(res.statusCode).toBe(200);
  });
});
