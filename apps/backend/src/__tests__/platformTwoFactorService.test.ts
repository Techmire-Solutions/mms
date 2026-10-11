import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredPlatformUser } from "@mms/shared";

const mocks = vi.hoisted(() => ({
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
  getAuthArtifact: vi.fn(),
  deleteAuthArtifact: vi.fn(),
  createArtifactId: vi.fn(() => "challenge-1"),
  dispatchPlatformOtp: vi.fn(),
  getStoredPlatformUserById: vi.fn(),
  hashOtpCode: vi.fn(),
  verifyOtpCode: vi.fn(),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  putAuthArtifact: mocks.putAuthArtifact,
  takeAuthArtifact: mocks.takeAuthArtifact,
  getAuthArtifact: mocks.getAuthArtifact,
  deleteAuthArtifact: mocks.deleteAuthArtifact,
  createArtifactId: mocks.createArtifactId,
}));

vi.mock("../services/platform/platformOtpService.js", () => ({
  dispatchPlatformOtp: mocks.dispatchPlatformOtp,
}));

vi.mock("../services/platform/platformUserService.js", () => ({
  getStoredPlatformUserById: mocks.getStoredPlatformUserById,
}));

vi.mock("../services/auth/authCookieService.js", () => ({
  generateOtpCode: vi.fn(() => "123456"),
  hashOtpCode: mocks.hashOtpCode,
  verifyOtpCode: mocks.verifyOtpCode,
}));

import {
  createPlatformTwoFactorChallenge,
  isPlatformTwoFactorRequired,
  resendPlatformTwoFactorChallenge,
  verifyPlatformTwoFactorChallenge,
} from "../services/platform/platformTwoFactorService.js";

const user: StoredPlatformUser = {
  id: "p-super",
  email: "admin@platform.com",
  name: "Super Admin",
  passwordHash: "hash",
  role: "super_user",
  permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
  sessionVersion: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  disabledAt: null,
};

describe("platformTwoFactorService", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    mocks.putAuthArtifact.mockResolvedValue("challenge-1");
    mocks.dispatchPlatformOtp.mockResolvedValue({ sent: true });
    mocks.getStoredPlatformUserById.mockResolvedValue(user);
    mocks.hashOtpCode.mockReturnValue("hashed-code");
    mocks.verifyOtpCode.mockImplementation((code: string) => code === "123456");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("isPlatformTwoFactorRequired reflects PLATFORM_REQUIRE_2FA", () => {
    vi.stubEnv("PLATFORM_REQUIRE_2FA", "true");
    expect(isPlatformTwoFactorRequired()).toBe(true);
    vi.stubEnv("PLATFORM_REQUIRE_2FA", "false");
    expect(isPlatformTwoFactorRequired()).toBe(false);
  });

  it("creates a challenge and dispatches the OTP", async () => {
    const challengeId = await createPlatformTwoFactorChallenge(user);
    expect(challengeId).toBe("challenge-1");
    expect(mocks.putAuthArtifact).toHaveBeenCalledWith(
      "platform_two_factor_challenge",
      expect.objectContaining({ userId: user.id, attempts: 0 }),
      expect.any(Number),
      "challenge-1",
    );
    expect(mocks.dispatchPlatformOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email }),
    );
  });

  it("returns null when the OTP cannot be delivered in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.dispatchPlatformOtp.mockResolvedValue({ sent: false });
    const challengeId = await createPlatformTwoFactorChallenge(user);
    expect(challengeId).toBeNull();
    expect(mocks.takeAuthArtifact).toHaveBeenCalled();
  });

  it("verifies a correct code and returns the user", async () => {
    mocks.takeAuthArtifact.mockResolvedValue({
      id: "challenge-1",
      kind: "platform_two_factor_challenge",
      payload: { userId: user.id, codeHash: "hashed-code", attempts: 0 },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await verifyPlatformTwoFactorChallenge("challenge-1", "123456");
    expect(result).toEqual(user);
    expect(mocks.verifyOtpCode).toHaveBeenCalledWith("123456", "hashed-code");
  });

  it("returns null for an incorrect code", async () => {
    mocks.takeAuthArtifact.mockResolvedValue({
      id: "challenge-1",
      kind: "platform_two_factor_challenge",
      payload: { userId: user.id, codeHash: "hashed-code", attempts: 0 },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await verifyPlatformTwoFactorChallenge("challenge-1", "000000");
    expect(result).toBeNull();
  });

  it("returns null for a disabled user even with a correct code", async () => {
    mocks.getStoredPlatformUserById.mockResolvedValue({
      ...user,
      disabledAt: "2026-01-02T00:00:00.000Z",
    });
    mocks.takeAuthArtifact.mockResolvedValue({
      id: "challenge-1",
      kind: "platform_two_factor_challenge",
      payload: { userId: user.id, codeHash: "hashed-code", attempts: 0 },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await verifyPlatformTwoFactorChallenge("challenge-1", "123456");
    expect(result).toBeNull();
  });

  it("returns null for an unknown or expired challenge", async () => {
    mocks.takeAuthArtifact.mockResolvedValue(null);
    const result = await verifyPlatformTwoFactorChallenge("missing", "123456");
    expect(result).toBeNull();
  });

  it("resends a fresh code and resets attempts", async () => {
    mocks.getAuthArtifact.mockResolvedValue({
      id: "challenge-1",
      kind: "platform_two_factor_challenge",
      payload: { userId: user.id, codeHash: "old-hash", attempts: 3 },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await resendPlatformTwoFactorChallenge("challenge-1");

    expect(result).toEqual({ ok: true, devCode: undefined });
    expect(mocks.deleteAuthArtifact).toHaveBeenCalledWith("challenge-1");
    expect(mocks.putAuthArtifact).toHaveBeenCalledWith(
      "platform_two_factor_challenge",
      expect.objectContaining({ userId: user.id, attempts: 0, codeHash: "hashed-code" }),
      expect.any(Number),
      "challenge-1",
    );
    expect(mocks.dispatchPlatformOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email }),
    );
  });

  it("returns ok:false when the challenge is missing or expired", async () => {
    mocks.getAuthArtifact.mockResolvedValue(null);
    const result = await resendPlatformTwoFactorChallenge("missing");
    expect(result).toEqual({ ok: false });
  });

  it("returns ok:false when resend cannot be delivered in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getAuthArtifact.mockResolvedValue({
      id: "challenge-1",
      kind: "platform_two_factor_challenge",
      payload: { userId: user.id, codeHash: "old-hash", attempts: 0 },
      expiresAt: new Date(Date.now() + 60_000),
    });
    mocks.dispatchPlatformOtp.mockResolvedValue({ sent: false });

    const result = await resendPlatformTwoFactorChallenge("challenge-1");
    expect(result).toEqual({ ok: false });
    expect(mocks.deleteAuthArtifact).toHaveBeenCalledWith("challenge-1");
  });
});
