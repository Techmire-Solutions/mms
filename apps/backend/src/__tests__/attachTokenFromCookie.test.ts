import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { attachTokenFromCookie, extractTokenFromCookie } from "../lib/attachTokenFromCookie.js";

function minimalRequest(partial: {
  cookies?: Record<string, string | undefined>;
  header?: string;
  authorization?: string;
}): FastifyRequest {
  const headers: Record<string, string | undefined> = {};
  if (partial.header !== undefined) headers.cookie = partial.header;
  if (partial.authorization !== undefined) headers.authorization = partial.authorization;
  return {
    headers,
    cookies: partial.cookies,
  } as unknown as FastifyRequest;
}

describe("extractTokenFromCookie", () => {
  it("reads the token from parsed cookies", () => {
    const req = minimalRequest({ cookies: { mms_access: "parsed-token" } });
    expect(extractTokenFromCookie(req, "mms_access")).toBe("parsed-token");
  });

  it("falls back to the raw Cookie header when the parser has not run", () => {
    const req = minimalRequest({
      header: "other=1; mms_access=raw-token; csrf_token=abc",
    });
    expect(extractTokenFromCookie(req, "mms_access")).toBe("raw-token");
  });

  it("URI-decodes the raw-header fallback value", () => {
    const req = minimalRequest({ header: "mms_platform_access=a%20b%26c" });
    expect(extractTokenFromCookie(req, "mms_platform_access")).toBe("a b&c");
  });

  it("matches the cookie name at the start of the header", () => {
    const req = minimalRequest({ header: "mms_access=first-token" });
    expect(extractTokenFromCookie(req, "mms_access")).toBe("first-token");
  });

  it("returns null when the cookie is absent", () => {
    const req = minimalRequest({ header: "unrelated=1", cookies: {} });
    expect(extractTokenFromCookie(req, "mms_access")).toBeNull();
  });
});

describe("attachTokenFromCookie", () => {
  it("attaches a Bearer header from parsed cookies", () => {
    const req = minimalRequest({ cookies: { mms_access: "parsed-token" } });
    attachTokenFromCookie(req, "mms_access");
    expect(req.headers.authorization).toBe("Bearer parsed-token");
  });

  it("attaches a Bearer header from the raw cookie header", () => {
    const req = minimalRequest({ header: "mms_platform_access=raw-token" });
    attachTokenFromCookie(req, "mms_platform_access");
    expect(req.headers.authorization).toBe("Bearer raw-token");
  });

  it("preserves an existing Authorization header", () => {
    const req = minimalRequest({
      cookies: { mms_access: "cookie-token" },
      authorization: "Bearer explicit-token",
    });
    attachTokenFromCookie(req, "mms_access");
    expect(req.headers.authorization).toBe("Bearer explicit-token");
  });

  it("leaves the request untouched when no token is present", () => {
    const req = minimalRequest({ cookies: {} });
    attachTokenFromCookie(req, "mms_access");
    expect(req.headers.authorization).toBeUndefined();
  });
});
