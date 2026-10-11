import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionTimeoutPolicy } from "@mms/shared";
import {
  enforcePlatformSessionClock,
  enforceTenantSessionClock,
} from "../services/sessionGuardService.js";

const mocks = vi.hoisted(() => ({
  isSessionIdleExpired: vi.fn(),
  isSessionAbsoluteExpired: vi.fn(),
  revokeSession: vi.fn(),
  touchSession: vi.fn(),
  deleteRefreshTokensForUser: vi.fn(),
}));

vi.mock("../services/sessionClockService.js", () => ({
  isSessionIdleExpired: mocks.isSessionIdleExpired,
  isSessionAbsoluteExpired: mocks.isSessionAbsoluteExpired,
  revokeSession: mocks.revokeSession,
  touchSession: mocks.touchSession,
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  deleteRefreshTokensForUser: mocks.deleteRefreshTokensForUser,
}));

const policy: SessionTimeoutPolicy = {
  idleMs: 60 * 60 * 1000,
  warnBeforeMs: 60_000,
  absoluteMs: null,
};

describe("sessionGuardService", () => {
  beforeEach(() => {
    mocks.isSessionIdleExpired.mockResolvedValue(false);
    mocks.isSessionAbsoluteExpired.mockResolvedValue(false);
    mocks.deleteRefreshTokensForUser.mockResolvedValue(undefined);
    mocks.revokeSession.mockResolvedValue(undefined);
    mocks.touchSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok and slides the clock when active", async () => {
    await expect(
      enforceTenantSessionClock({ scope: "tn:t:u1", policy, jti: "j1", userId: "u1" }),
    ).resolves.toBe("ok");
    expect(mocks.touchSession).toHaveBeenCalledWith("tn:t:u1", policy.idleMs);
    expect(mocks.deleteRefreshTokensForUser).not.toHaveBeenCalled();
  });

  it("full-revokes (access + refresh) on idle expiry", async () => {
    mocks.isSessionIdleExpired.mockResolvedValue(true);
    const outcome = await enforceTenantSessionClock({
      scope: "tn:t:u1",
      policy,
      jti: "j1",
      userId: "u1",
    });
    expect(outcome).toBe("idle_expired");
    expect(mocks.revokeSession).toHaveBeenCalledWith("tn:t:u1", "j1");
    expect(mocks.deleteRefreshTokensForUser).toHaveBeenCalledWith("u1");
    expect(mocks.touchSession).not.toHaveBeenCalled();
  });

  it("full-revokes on absolute expiry", async () => {
    mocks.isSessionAbsoluteExpired.mockResolvedValue(true);
    const outcome = await enforceTenantSessionClock({
      scope: "tn:t:u1",
      policy,
      jti: "j1",
      userId: "u1",
    });
    expect(outcome).toBe("absolute_expired");
    expect(mocks.deleteRefreshTokensForUser).toHaveBeenCalledWith("u1");
  });

  it("platform guard revokes access but never deletes refresh tokens", async () => {
    mocks.isSessionIdleExpired.mockResolvedValue(true);
    const outcome = await enforcePlatformSessionClock({ scope: "plat:u1", policy, jti: "j1" });
    expect(outcome).toBe("idle_expired");
    expect(mocks.revokeSession).toHaveBeenCalledWith("plat:u1", "j1");
    expect(mocks.deleteRefreshTokensForUser).not.toHaveBeenCalled();
  });
});
