import { describe, expect, it, vi } from "vitest";
import { clearAuthCookies, setAuthCookies } from "../services/auth/authCookieService.js";

function fakeReply() {
  return { setCookie: vi.fn(), clearCookie: vi.fn() };
}

describe("refresh cookie path", () => {
  it("scopes the refresh cookie to the refresh endpoint", () => {
    const reply = fakeReply();
    setAuthCookies(reply as never, "access-token", "refresh-token");

    const refresh = reply.setCookie.mock.calls.find(([name]) => name === "mms_refresh");
    expect(refresh?.[2]).toMatchObject({ path: "/api/auth/refresh", httpOnly: true });

    const access = reply.setCookie.mock.calls.find(([name]) => name === "mms_access");
    expect(access?.[2]).toMatchObject({ path: "/" });
  });

  it("clears both the narrow and legacy broad refresh cookie", () => {
    const reply = fakeReply();
    clearAuthCookies(reply as never);

    const cleared = reply.clearCookie.mock.calls
      .filter(([name]) => name === "mms_refresh")
      .map(([, options]) => options.path);
    expect(cleared).toEqual(["/api/auth/refresh", "/"]);
  });
});
