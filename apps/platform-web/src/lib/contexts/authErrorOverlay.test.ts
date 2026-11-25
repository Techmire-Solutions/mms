import { describe, expect, it } from "vitest";
import { shouldShowUserNotRegisteredOverlay } from "./authErrorOverlay";

describe("shouldShowUserNotRegisteredOverlay", () => {
  it("given a tenant app path with a user_not_registered error, should show the overlay when rendered", () => {
    expect(
      shouldShowUserNotRegisteredOverlay({
        isTenantHost: true,
        pathname: "/students",
        authErrorType: "user_not_registered",
      }),
    ).toBe(true);
  });

  it("given a tenant entry or public path, should not replace it with the overlay when rendered", () => {
    for (const pathname of ["/login", "/forgot-password", "/2fa", "/apply", "/apply/al-noor"]) {
      expect(
        shouldShowUserNotRegisteredOverlay({
          isTenantHost: true,
          pathname,
          authErrorType: "user_not_registered",
        }),
        `expected ${pathname} to keep its own page`,
      ).toBe(false);
    }
  });

  it("given a non-tenant host, should not show the overlay when rendered", () => {
    expect(
      shouldShowUserNotRegisteredOverlay({
        isTenantHost: false,
        pathname: "/students",
        authErrorType: "user_not_registered",
      }),
    ).toBe(false);
  });

  it("given any other auth error, should not show the overlay when rendered", () => {
    expect(
      shouldShowUserNotRegisteredOverlay({
        isTenantHost: true,
        pathname: "/students",
        authErrorType: "invalid_credentials",
      }),
    ).toBe(false);
  });
});
