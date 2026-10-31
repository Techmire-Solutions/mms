import { describe, expect, it } from "vitest";
import { AUTH_PATHS, isTenantSessionRequest } from "./apiClientHelpers";

describe("isTenantSessionRequest", () => {
  it("does not turn an anonymous auth probe into a session-expiry redirect", () => {
    expect(isTenantSessionRequest(AUTH_PATHS.me)).toBe(false);
  });

  it("still treats protected tenant data requests as session-bound", () => {
    expect(isTenantSessionRequest("/api/students")).toBe(true);
  });
});
