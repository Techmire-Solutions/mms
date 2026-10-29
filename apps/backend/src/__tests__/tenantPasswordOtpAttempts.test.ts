import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyReply } from "fastify";
import type { JWT } from "@fastify/jwt";

const mocks = vi.hoisted(() => ({
  findAuthArtifactByLookupKey: vi.fn(),
  updateAuthArtifactPayload: vi.fn(),
  deleteAuthArtifact: vi.fn(),
  putAuthArtifact: vi.fn(),
  activateInvitedTenantUserRow: vi.fn(),
  establishSession: vi.fn(),
  getPublicUserById: vi.fn(),
  findUserByLoginEmailAndWorkspace: vi.fn(),
  broadcastCollection: vi.fn(),
  assertPasswordMeetsPolicy: vi.fn(),
  loadGlobalSettings: vi.fn(),
  dispatchTenantPasswordOtp: vi.fn(),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  findAuthArtifactByLookupKey: mocks.findAuthArtifactByLookupKey,
  updateAuthArtifactPayload: mocks.updateAuthArtifactPayload,
  deleteAuthArtifact: mocks.deleteAuthArtifact,
  putAuthArtifact: mocks.putAuthArtifact,
}));

vi.mock("../services/auth/tenantPasswordOtpDispatch.js", () => ({
  dispatchTenantPasswordOtp: mocks.dispatchTenantPasswordOtp,
  sendTenantWelcomeEmail: vi.fn(),
}));

vi.mock("../services/globalSettingsService.js", () => ({
  assertPasswordMeetsPolicy: mocks.assertPasswordMeetsPolicy,
  loadGlobalSettings: mocks.loadGlobalSettings,
}));

vi.mock("../db/repositories/tenantUserRepository.js", () => ({
  activateInvitedTenantUserRow: mocks.activateInvitedTenantUserRow,
}));

vi.mock("../services/auth/authService.js", () => ({
  establishSession: mocks.establishSession,
}));

vi.mock("../services/auth/userService.js", () => ({
  findUserByLoginEmailAndWorkspace: mocks.findUserByLoginEmailAndWorkspace,
  getPublicUserById: mocks.getPublicUserById,
}));

vi.mock("../users/repository/usersRepositoryAdapter.js", () => ({
  usersRepository: { bulkSaveActivityLogs: vi.fn() },
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: mocks.broadcastCollection,
}));

import { hashOtpCode } from "../services/auth/authCookieService.js";
import {
  resetTenantPassword,
  verifyTenantPasswordResetOtp,
  type TenantPasswordOtpPayload,
} from "../services/auth/tenantPasswordOtpService.js";

const correctCode = "123456";
const wrongCode = "000000";

let stored: TenantPasswordOtpPayload;

function resetInput() {
  return {
    email: "user@example.com",
    workspaceSubdomain: "demo",
    code: wrongCode,
    password: "NewPassword1!",
    jwtSigner: {} as unknown as JWT,
    reply: {} as unknown as FastifyReply,
  };
}

/**
 * F46: the 5-attempt lockout only counted on `/forgot-password/verify`, so an
 * attacker could keep guessing through `/forgot-password/reset`. Both paths now
 * share one attempt-counting helper.
 */
describe("tenant password OTP attempt lockout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stored = {
      userId: "u-1",
      workspaceSubdomain: "demo",
      email: "user@example.com",
      codeHash: hashOtpCode(correctCode),
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    mocks.findAuthArtifactByLookupKey.mockImplementation(async () => ({
      id: "otp-1",
      kind: "tenant_password_otp",
      payload: stored,
      expiresAt: new Date(Date.now() + 60_000),
    }));
    mocks.updateAuthArtifactPayload.mockImplementation(
      async (_id: string, payload: TenantPasswordOtpPayload) => {
        stored = payload;
      },
    );
  });

  it("accepts the correct code without burning an attempt", async () => {
    await expect(
      verifyTenantPasswordResetOtp({
        email: "user@example.com",
        workspaceSubdomain: "demo",
        code: correctCode,
      }),
    ).resolves.toEqual({ ok: true });
    expect(mocks.updateAuthArtifactPayload).not.toHaveBeenCalled();
    expect(mocks.deleteAuthArtifact).not.toHaveBeenCalled();
  });

  it("increments attempts from both verify and reset and locks at five", async () => {
    await expect(
      verifyTenantPasswordResetOtp({
        email: "user@example.com",
        workspaceSubdomain: "demo",
        code: wrongCode,
      }),
    ).rejects.toMatchObject({ code: "invalid_code" });
    expect(stored.attempts).toBe(1);

    await expect(resetTenantPassword(resetInput())).rejects.toMatchObject({
      code: "invalid_code",
    });
    expect(stored.attempts).toBe(2);

    await expect(
      verifyTenantPasswordResetOtp({
        email: "user@example.com",
        workspaceSubdomain: "demo",
        code: wrongCode,
      }),
    ).rejects.toMatchObject({ code: "invalid_code" });
    expect(stored.attempts).toBe(3);

    await expect(resetTenantPassword(resetInput())).rejects.toMatchObject({
      code: "invalid_code",
    });
    expect(stored.attempts).toBe(4);

    await expect(resetTenantPassword(resetInput())).rejects.toMatchObject({
      code: "too_many_attempts",
    });
    expect(mocks.deleteAuthArtifact).toHaveBeenCalledWith("otp-1");
    expect(mocks.updateAuthArtifactPayload).toHaveBeenCalledTimes(4);
  });
});
