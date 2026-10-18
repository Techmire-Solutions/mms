import fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerErrorHandlers } from "../lib/errorHandler.js";
import { AUTH_RATE_LIMIT } from "../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../lib/rateLimitGuard.js";
import { registerSecurityPlugins, isRateLimitExempt } from "../plugins/security.js";

describe("security rate limiter", () => {
  const apps: ReturnType<typeof fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("correctly classifies exempt paths with isRateLimitExempt", () => {
    expect(isRateLimitExempt("/health")).toBe(true);
    expect(isRateLimitExempt("/ready")).toBe(true);
    expect(isRateLimitExempt("/metrics")).toBe(true);
    expect(isRateLimitExempt("/assets/index-BTufUDnn.js")).toBe(true);
    expect(isRateLimitExempt("/assets/index-B5aRUblQ.css")).toBe(true);
    expect(isRateLimitExempt("/favicon.svg")).toBe(true);
    expect(isRateLimitExempt("/favicon.ico")).toBe(true);
    expect(isRateLimitExempt("/site.webmanifest")).toBe(true);
    expect(isRateLimitExempt("/login")).toBe(true);
    expect(isRateLimitExempt("/uploads/avatars/user.jpg")).toBe(true);
    expect(isRateLimitExempt("/api/contacts")).toBe(false);
    expect(isRateLimitExempt("/api/auth/login")).toBe(false);
    expect(isRateLimitExempt("/API/contacts")).toBe(false);
    expect(isRateLimitExempt("//api/contacts")).toBe(false);
  });

  /**
   * Regression: `registerSecurityPlugins` now installs a GLOBAL limiter
   * (`global: true`). The plugin's preHandler-style `fastify.rateLimit()`
   * returns early once the global `onRequest` hook has run, so a stricter
   * per-route limit expressed that way would silently stop being enforced.
   * `createStrictRateLimitGuard` must keep working alongside the global limit.
   */
  it("enforces a strict per-route limit even with a global limiter registered", async () => {
    const app = fastify({ logger: false });
    apps.push(app);
    await registerSecurityPlugins(app);
    registerErrorHandlers(app, false);

    const strictLimit = createStrictRateLimitGuard(app, {
      ...AUTH_RATE_LIMIT,
      max: 1,
    });

    app.post("/sensitive", { preHandler: strictLimit }, async () => ({ success: true }));

    const first = await app.inject({ method: "POST", url: "/sensitive" });
    const second = await app.inject({ method: "POST", url: "/sensitive" });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.json()).toEqual({
      type: "rate_limit_exceeded",
      code: "rate_limit_exceeded",
      message: "Too many requests. Please try again later.",
    });
    expect(typeof second.headers["retry-after"]).toBe("string");
  });

  it("does not throttle health or readiness probes", async () => {
    const app = fastify({ logger: false });
    apps.push(app);
    await registerSecurityPlugins(app);
    registerErrorHandlers(app, false);

    app.get("/health", async () => ({ ok: true }));
    app.get("/ready", async () => ({ ok: true }));

    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
    }
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
  });

  it("exempts static assets, manifests, icons, and non-API SPA paths from rate limiting", async () => {
    const app = fastify({ logger: false });
    apps.push(app);
    await registerSecurityPlugins(app);
    registerErrorHandlers(app, false);

    app.get("/assets/index-BTufUDnn.js", async () => 'console.log("ok");');
    app.get("/assets/index-B5aRUblQ.css", async () => "body { color: red; }");
    app.get("/site.webmanifest", async () => ({ name: "MMS" }));
    app.get("/favicon.svg", async () => "<svg></svg>");
    app.get("/login", async () => "<html></html>");

    const assetJs = await app.inject({ method: "GET", url: "/assets/index-BTufUDnn.js" });
    expect(assetJs.statusCode).toBe(200);
    expect(assetJs.headers["x-ratelimit-limit"]).toBeUndefined();

    const assetCss = await app.inject({ method: "GET", url: "/assets/index-B5aRUblQ.css" });
    expect(assetCss.statusCode).toBe(200);
    expect(assetCss.headers["x-ratelimit-limit"]).toBeUndefined();

    const manifest = await app.inject({ method: "GET", url: "/site.webmanifest" });
    expect(manifest.statusCode).toBe(200);
    expect(manifest.headers["x-ratelimit-limit"]).toBeUndefined();

    const favicon = await app.inject({ method: "GET", url: "/favicon.svg" });
    expect(favicon.statusCode).toBe(200);
    expect(favicon.headers["x-ratelimit-limit"]).toBeUndefined();

    const loginDoc = await app.inject({ method: "GET", url: "/login" });
    expect(loginDoc.statusCode).toBe(200);
    expect(loginDoc.headers["x-ratelimit-limit"]).toBeUndefined();
  });

  it("applies the global limit to API routes that do not opt into a stricter one", async () => {
    const app = fastify({ logger: false });
    apps.push(app);
    await registerSecurityPlugins(app);
    registerErrorHandlers(app, false);

    app.get("/api/sample", async () => ({ ok: true }));

    const res = await app.inject({ method: "GET", url: "/api/sample" });
    expect(res.statusCode).toBe(200);
    // The global limiter advertises its budget on every API response.
    expect(typeof res.headers["x-ratelimit-limit"]).toBe("string");
  });
});
