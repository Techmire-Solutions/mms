import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashOtpCode,
  hashRefreshToken,
  verifyOtpCode,
} from "../services/auth/authCookieService.js";

const mockFindRefreshTokenByHash = vi.fn();

vi.mock("../services/auth/authArtifactService.js", () => ({
  findRefreshTokenByHash: (...args: unknown[]) => mockFindRefreshTokenByHash(...args),
}));

import { validateRefreshToken } from "../services/auth/twoFactorService.js";

describe("validateRefreshToken", () => {
  beforeEach(() => {
    mockFindRefreshTokenByHash.mockReset();
  });

  it("returns null for empty token", async () => {
    await expect(validateRefreshToken("", "demo")).resolves.toBeNull();
  });

  it("returns null when artifact is not found", async () => {
    mockFindRefreshTokenByHash.mockResolvedValue(null);
    await expect(validateRefreshToken("token", "demo")).resolves.toBeNull();
  });

  it("returns null when workspace subdomain does not match", async () => {
    mockFindRefreshTokenByHash.mockResolvedValue({
      id: "a1",
      kind: "refresh_token",
      payload: {
        userId: "u1",
        workspaceSubdomain: "other",
        tokenHash: hashRefreshToken("token"),
      },
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(validateRefreshToken("token", "demo")).resolves.toBeNull();
  });

  it("returns payload and artifact id for valid token", async () => {
    mockFindRefreshTokenByHash.mockResolvedValue({
      id: "a1",
      kind: "refresh_token",
      payload: {
        userId: "u1",
        workspaceSubdomain: "demo",
        tokenHash: hashRefreshToken("token"),
      },
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(validateRefreshToken("token", "demo")).resolves.toEqual({
      payload: {
        userId: "u1",
        workspaceSubdomain: "demo",
        tokenHash: hashRefreshToken("token"),
      },
      artifactId: "a1",
    });
  });
});

describe("verifyOtpCode", () => {
  it("rejects the former development shortcut code when it does not match the hash", () => {
    expect(verifyOtpCode("123456", hashOtpCode("654321"))).toBe(false);
  });

  it("accepts only the code represented by the stored hash", () => {
    expect(verifyOtpCode("654321", hashOtpCode("654321"))).toBe(true);
  });
});
