import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashOtpCode } from "../services/auth/authCookieService.js";

const mocks = vi.hoisted(() => ({
  consumeAuthArtifactWithPayload: vi.fn(),
  getAuthArtifact: vi.fn(),
  putAuthArtifact: vi.fn(),
  deleteAuthArtifact: vi.fn(),
  getPublicUserById: vi.fn(),
  loadGlobalSettings: vi.fn(),
  sendTenantEmail: vi.fn(),
  sendTenantSms: vi.fn(),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  authArtifactUserScopeKey: (userId: string) => `user:${userId}`,
  authArtifactWorkspaceScopeKey: (subdomain: string) => `ws:${subdomain}`,
  createArtifactId: () => "challenge-id",
  consumeAuthArtifactWithPayload: mocks.consumeAuthArtifactWithPayload,
  getAuthArtifact: mocks.getAuthArtifact,
  putAuthArtifact: mocks.putAuthArtifact,
  deleteAuthArtifact: mocks.deleteAuthArtifact,
}));

vi.mock("../services/auth/userService.js", () => ({
  getPublicUserById: mocks.getPublicUserById,
}));

vi.mock("../services/globalSettingsService.js", () => ({
  loadGlobalSettings: mocks.loadGlobalSettings,
}));

vi.mock("../services/email/emailService.js", () => ({
  sendTenantEmail: mocks.sendTenantEmail,
}));

vi.mock("../services/sms/smsService.js", () => ({
  sendTenantSms: mocks.sendTenantSms,
}));

import {
  resendTwoFactorChallenge,
  verifyTwoFactorChallenge,
} from "../services/auth/twoFactorService.js";
import type { TwoFactorChallengePayload } from "../services/auth/twoFactorService.js";

function challengePayload(workspaceSubdomain: string, attempts = 0): TwoFactorChallengePayload {
  return {
    userId: "u-1",
    email: "admin@example.com",
    workspaceSubdomain,
    codeHash: hashOtpCode("123456"),
    attempts,
  };
}

function artifactFor(payload: TwoFactorChallengePayload) {
  return {
    id: "challenge-1",
    kind: "two_factor_challenge",
    payload,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

const user = {
  id: "u-1",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  workspaceSubdomain: "alpha",
};

/**
 * F45: a 2FA challenge minted for workspace A must not be completable (or
 * re-sent) from workspace B's host; the token was already workspace-bound, but
 * the challenge exchange itself was a cross-workspace login-CSRF vector.
 */
describe("2FA challenge tenant binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicUserById.mockResolvedValue(user);
    mocks.loadGlobalSettings.mockResolvedValue({
      emailNotifications: true,
      smsNotifications: false,
    });
    mocks.sendTenantEmail.mockResolvedValue({ sent: true });
    mocks.sendTenantSms.mockResolvedValue({ sent: true });
  });

  it("verifies a challenge from the requesting workspace", async () => {
    mocks.consumeAuthArtifactWithPayload.mockResolvedValue(artifactFor(challengePayload("alpha")));

    await expect(verifyTwoFactorChallenge("challenge-1", "123456", "alpha")).resolves.toEqual(user);
    expect(mocks.getPublicUserById).toHaveBeenCalledTimes(1);
  });

  it("rejects a challenge minted for another workspace", async () => {
    mocks.consumeAuthArtifactWithPayload.mockResolvedValue(artifactFor(challengePayload("alpha")));

    await expect(verifyTwoFactorChallenge("challenge-1", "123456", "beta")).resolves.toBeNull();
    expect(mocks.getPublicUserById).not.toHaveBeenCalled();
  });

  it("does not resend a challenge from another workspace", async () => {
    mocks.getAuthArtifact.mockResolvedValue(artifactFor(challengePayload("alpha")));

    await expect(resendTwoFactorChallenge("challenge-1", "beta")).resolves.toBe(false);
    expect(mocks.deleteAuthArtifact).not.toHaveBeenCalled();
    expect(mocks.sendTenantEmail).not.toHaveBeenCalled();
  });

  it("resends a challenge for the requesting workspace and resets attempts", async () => {
    mocks.getAuthArtifact.mockResolvedValue(artifactFor(challengePayload("alpha", 3)));

    await expect(resendTwoFactorChallenge("challenge-1", "Alpha")).resolves.toBe(true);
    expect(mocks.deleteAuthArtifact).toHaveBeenCalledTimes(1);
    expect(mocks.putAuthArtifact).toHaveBeenCalledTimes(1);
    expect(mocks.putAuthArtifact.mock.calls[0]?.[1]).toMatchObject({ attempts: 0 });
  });

  it("re-arms the challenge with an incremented attempt count on a wrong code", async () => {
    mocks.consumeAuthArtifactWithPayload.mockResolvedValue(
      artifactFor(challengePayload("alpha", 0)),
    );

    await expect(verifyTwoFactorChallenge("challenge-1", "000000", "alpha")).resolves.toBeNull();

    expect(mocks.putAuthArtifact).toHaveBeenCalledTimes(1);
    const [, payload, ttl, options] = mocks.putAuthArtifact.mock.calls[0] ?? [];
    expect(payload).toMatchObject({ attempts: 1 });
    expect(ttl).toBeGreaterThan(0);
    expect(options).toMatchObject({ id: "challenge-1" });
  });

  it("does not re-arm the challenge at the shared attempt ceiling", async () => {
    mocks.consumeAuthArtifactWithPayload.mockResolvedValue(
      artifactFor(challengePayload("alpha", 4)),
    );

    await expect(verifyTwoFactorChallenge("challenge-1", "000000", "alpha")).resolves.toBeNull();

    expect(mocks.putAuthArtifact).not.toHaveBeenCalled();
    expect(mocks.getPublicUserById).not.toHaveBeenCalled();
  });

  it("fails closed when another request already claimed the challenge", async () => {
    mocks.consumeAuthArtifactWithPayload.mockResolvedValue(null);

    await expect(verifyTwoFactorChallenge("challenge-1", "123456", "alpha")).resolves.toBeNull();
    expect(mocks.getPublicUserById).not.toHaveBeenCalled();
  });
});
