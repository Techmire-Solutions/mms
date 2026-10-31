import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { attachAccessTokenFromCookie } from "../services/auth/authCookieService.js";
import { attachPlatformTokenFromCookie } from "../services/platform/platformCookieService.js";

describe("attachAccessTokenFromCookie", () => {
  it("extracts from parsed cookies", () => {
    const req = {
      headers: {},
      cookies: { mms_access: "sample-access-token" },
    } as unknown as FastifyRequest;
    attachAccessTokenFromCookie(req);
    expect(req.headers.authorization).toBe("Bearer sample-access-token");
  });

  it("extracts from raw cookie header when cookies parser has not run yet", () => {
    const req = {
      headers: { cookie: "other=1; mms_access=raw-cookie-token; csrf_token=abc" },
    } as unknown as FastifyRequest;
    attachAccessTokenFromCookie(req);
    expect(req.headers.authorization).toBe("Bearer raw-cookie-token");
  });

  it("preserves existing Authorization header", () => {
    const req = {
      headers: { authorization: "Bearer explicit-token", cookie: "mms_access=other-token" },
      cookies: { mms_access: "other-token" },
    } as unknown as FastifyRequest;
    attachAccessTokenFromCookie(req);
    expect(req.headers.authorization).toBe("Bearer explicit-token");
  });
});

describe("attachPlatformTokenFromCookie", () => {
  it("extracts from parsed cookies", () => {
    const req = {
      headers: {},
      cookies: { mms_platform_access: "sample-platform-token" },
    } as unknown as FastifyRequest;
    attachPlatformTokenFromCookie(req);
    expect(req.headers.authorization).toBe("Bearer sample-platform-token");
  });

  it("extracts from raw cookie header when cookies parser has not run yet", () => {
    const req = {
      headers: { cookie: "mms_platform_access=raw-platform-token" },
    } as unknown as FastifyRequest;
    attachPlatformTokenFromCookie(req);
    expect(req.headers.authorization).toBe("Bearer raw-platform-token");
  });
});
