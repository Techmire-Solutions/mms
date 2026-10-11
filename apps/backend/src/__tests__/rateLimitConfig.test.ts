import { describe, expect, it } from "vitest";
import fastify, { type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import {
  AUTH_RATE_LIMIT,
  MESSAGING_LOG_RATE_LIMIT,
  generateCompositeRateLimitKey,
  buildRateLimitExceededBody,
} from "../lib/rateLimitConfig.js";
import { runWithTenant } from "../lib/tenantContext.js";

describe("rateLimitConfig", () => {
  it("MESSAGING_LOG_RATE_LIMIT errorResponseBuilder returns rate_limit_exceeded", () => {
    expect(MESSAGING_LOG_RATE_LIMIT.errorResponseBuilder({}, { statusCode: 429 })).toEqual({
      statusCode: 429,
      code: "rate_limit_exceeded",
      type: "rate_limit_exceeded",
      message: "Too many message log requests. Please try again later.",
    });
  });

  it("AUTH_RATE_LIMIT errorResponseBuilder returns rate_limit_exceeded", () => {
    expect(AUTH_RATE_LIMIT.errorResponseBuilder({}, { statusCode: 429 })).toEqual({
      statusCode: 429,
      code: "rate_limit_exceeded",
      type: "rate_limit_exceeded",
      message: "Too many requests. Please try again later.",
    });
  });

  it("buildRateLimitExceededBody returns standard 429 payload", () => {
    expect(buildRateLimitExceededBody()).toEqual({
      statusCode: 429,
      code: "rate_limit_exceeded",
      type: "rate_limit_exceeded",
      message: "Too many requests. Please try again later.",
    });
  });

  describe("generateCompositeRateLimitKey", () => {
    it("uses getRequestTenant() when inside tenant context", () => {
      runWithTenant("tenant-ctx", () => {
        const fakeReq = {
          headers: {},
          ip: "192.168.1.100",
        } as unknown as FastifyRequest;
        expect(generateCompositeRateLimitKey(fakeReq)).toBe("tenant-ctx:192.168.1.100");
      });
    });

    it("extracts tenant from x-tenant-id header", () => {
      const fakeReq = {
        headers: { "x-tenant-id": "Tenant-Alpha " },
        ip: "10.0.0.1",
      } as unknown as FastifyRequest;
      expect(generateCompositeRateLimitKey(fakeReq)).toBe("tenant-alpha:10.0.0.1");
    });

    it("extracts tenant from host subdomain", () => {
      const fakeReq = {
        headers: { host: "demo.mms.local" },
        ip: "127.0.0.1",
      } as unknown as FastifyRequest;
      expect(generateCompositeRateLimitKey(fakeReq)).toBe("demo:127.0.0.1");
    });

    it("falls back to platform when no tenant is resolved", () => {
      const fakeReq = {
        headers: { host: "localhost:3000" },
        socket: { remoteAddress: "172.16.0.5" },
      } as unknown as FastifyRequest;
      expect(generateCompositeRateLimitKey(fakeReq)).toBe("platform:172.16.0.5");
    });
  });

  describe("Multi-tenant rate limit sliding window burst isolation", () => {
    it("exhausting rate limit on Tenant A does not throttle Tenant B on the same IP", async () => {
      const app = fastify();
      await app.register(rateLimit, {
        global: true,
        max: 3,
        timeWindow: "1 minute",
        keyGenerator: (req) => generateCompositeRateLimitKey(req),
        errorResponseBuilder: () => buildRateLimitExceededBody(),
      });

      app.get("/api/test-limit", async () => ({ status: "ok" }));
      await app.ready();

      // Tenant A: 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const res = await app.inject({
          method: "GET",
          url: "/api/test-limit",
          headers: { "x-tenant-id": "tenant-a" },
          remoteAddress: "203.0.113.195",
        });
        expect(res.statusCode).toBe(200);
      }

      // Tenant A: 4th request exceeds burst ceiling -> 429
      const throttledA = await app.inject({
        method: "GET",
        url: "/api/test-limit",
        headers: { "x-tenant-id": "tenant-a" },
        remoteAddress: "203.0.113.195",
      });
      expect(throttledA.statusCode).toBe(429);
      expect(throttledA.json()).toEqual(buildRateLimitExceededBody());

      // Tenant B from the SAME client IP must NOT be throttled
      const allowedB = await app.inject({
        method: "GET",
        url: "/api/test-limit",
        headers: { "x-tenant-id": "tenant-b" },
        remoteAddress: "203.0.113.195",
      });
      expect(allowedB.statusCode).toBe(200);
      expect(allowedB.json()).toEqual({ status: "ok" });

      await app.close();
    });
  });
});
