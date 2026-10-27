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

    it("ignores the client-supplied x-tenant-id header", () => {
      // A trusted header would let a caller mint a new bucket per request.
      const fakeReq = {
        headers: { "x-tenant-id": "Tenant-Alpha " },
        ip: "10.0.0.1",
      } as unknown as FastifyRequest;
      expect(generateCompositeRateLimitKey(fakeReq)).toBe("10.0.0.1");
    });

    it("ignores the host subdomain (also client-controlled, and only trusted once bound)", () => {
      const fakeReq = {
        headers: { host: "demo.mms.local" },
        ip: "127.0.0.1",
      } as unknown as FastifyRequest;
      expect(generateCompositeRateLimitKey(fakeReq)).toBe("127.0.0.1");
    });

    it("falls back to the socket address when no tenant is bound", () => {
      const fakeReq = {
        headers: { host: "localhost:3000" },
        socket: { remoteAddress: "172.16.0.5" },
      } as unknown as FastifyRequest;
      expect(generateCompositeRateLimitKey(fakeReq)).toBe("172.16.0.5");
    });

    it("still isolates distinct trusted tenants behind one IP", () => {
      const fakeReq = { headers: {}, ip: "192.168.1.100" } as unknown as FastifyRequest;
      const keyA = runWithTenant("tenant-a", () => generateCompositeRateLimitKey(fakeReq));
      const keyB = runWithTenant("tenant-b", () => generateCompositeRateLimitKey(fakeReq));
      expect(keyA).toBe("tenant-a:192.168.1.100");
      expect(keyB).toBe("tenant-b:192.168.1.100");
      expect(keyA).not.toBe(keyB);
    });
  });

  describe("rate limit bucket cannot be forged by header rotation", () => {
    it("rotating x-tenant-id does not grant a fresh budget", async () => {
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

      for (let i = 0; i < 3; i++) {
        const res = await app.inject({
          method: "GET",
          url: "/api/test-limit",
          headers: { "x-tenant-id": `tenant-${i}` },
          remoteAddress: "203.0.113.195",
        });
        expect(res.statusCode).toBe(200);
      }

      // Same client, new header value: the bucket is the IP, so the 4th request
      // is throttled. This is the regression the old key allowed.
      const throttled = await app.inject({
        method: "GET",
        url: "/api/test-limit",
        headers: { "x-tenant-id": "tenant-fresh" },
        remoteAddress: "203.0.113.195",
      });
      expect(throttled.statusCode).toBe(429);
      expect(throttled.json()).toEqual(buildRateLimitExceededBody());

      await app.close();
    });
  });
});
