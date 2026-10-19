import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredPlatformUser } from "@mms/shared";

const mocks = vi.hoisted(() => ({
  putAuthArtifact: vi.fn(),
  getAuthArtifact: vi.fn(),
  deleteAuthArtifact: vi.fn(),
  createArtifactId: vi.fn(() => "reset-artifact-1"),
  dispatchPlatformOtp: vi.fn(),
  sendPlatformSms: vi.fn(),
  findPlatformUserByEmail: vi.fn(),
  getStoredPlatformUserById: vi.fn(),
  updatePlatformUserPassword: vi.fn(),
  getPlatformSettings: vi.fn(),
  isPlatformSmtpConfigured: vi.fn(),
  hashOtpCode: vi.fn(),
  verifyOtpCode: vi.fn(),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  putAuthArtifact: mocks.putAuthArtifact,
  getAuthArtifact: mocks.getAuthArtifact,
  deleteAuthArtifact: mocks.deleteAuthArtifact,
  createArtifactId: mocks.createArtifactId,
}));

vi.mock("../services/platform/platformOtpService.js", () => ({
  dispatchPlatformOtp: mocks.dispatchPlatformOtp,
}));

vi.mock("../services/platform/platformSmsService.js", () => ({
  sendPlatformSms: mocks.sendPlatformSms,
}));

vi.mock("../services/platform/platformUserService.js", () => ({
  findPlatformUserByEmail: mocks.findPlatformUserByEmail,
  getStoredPlatformUserById: mocks.getStoredPlatformUserById,
  updatePlatformUserPassword: mocks.updatePlatformUserPassword,
}));

vi.mock("../services/platform/platformSettingsService.js", () => ({
  getPlatformSettings: mocks.getPlatformSettings,
}));

vi.mock("../services/platform/platformEmailService.js", () => ({
  isPlatformSmtpConfigured: mocks.isPlatformSmtpConfigured,
  resolvePlatformAppOrigin: vi.fn(() => "https://platform.mms.local"),
}));

vi.mock("../services/auth/authCookieService.js", () => ({
  generateOtpCode: vi.fn(() => "654321"),
  hashOtpCode: mocks.hashOtpCode,
  verifyOtpCode: mocks.verifyOtpCode,
}));

import {
  requestPlatformPasswordReset,
  resendPlatformPasswordReset,
} from "../services/platform/platformPasswordResetService.js";

const mockPlatformUser: StoredPlatformUser = {
  id: "p-admin-1",
  email: "ops@mms.local",
  name: "Ops Admin",
  passwordHash: "hash",
  role: "super_user",
  permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
  sessionVersion: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  disabledAt: null,
  phone: "+15555550199",
};

describe("platformPasswordResetService", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    mocks.putAuthArtifact.mockReset();
    mocks.getAuthArtifact.mockReset();
    mocks.deleteAuthArtifact.mockReset();
    mocks.dispatchPlatformOtp.mockReset();
    mocks.sendPlatformSms.mockReset();
    mocks.findPlatformUserByEmail.mockReset();
    mocks.getStoredPlatformUserById.mockReset();
    mocks.getPlatformSettings.mockReset();
    mocks.isPlatformSmtpConfigured.mockReset();

    mocks.findPlatformUserByEmail.mockResolvedValue(mockPlatformUser);
    mocks.getStoredPlatformUserById.mockResolvedValue(mockPlatformUser);
    mocks.dispatchPlatformOtp.mockResolvedValue({ sent: true });
    mocks.sendPlatformSms.mockResolvedValue({ sent: true });
    mocks.isPlatformSmtpConfigured.mockReturnValue(true);
    mocks.hashOtpCode.mockReturnValue("codehash");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("requestPlatformPasswordReset", () => {
    it("dispatches only email when channel is email", async () => {
      mocks.getPlatformSettings.mockReturnValue({
        emailNotifications: true,
        smsNotifications: false,
      });

      const result = await requestPlatformPasswordReset("ops@mms.local");

      expect(result.accepted).toBe(true);
      expect(mocks.dispatchPlatformOtp).toHaveBeenCalledTimes(1);
      expect(mocks.sendPlatformSms).not.toHaveBeenCalled();
    });

    it("dispatches only SMS when channel is sms and user has phone", async () => {
      mocks.getPlatformSettings.mockReturnValue({
        emailNotifications: false,
        smsNotifications: true,
      });

      const result = await requestPlatformPasswordReset("ops@mms.local");

      expect(result.accepted).toBe(true);
      expect(mocks.sendPlatformSms).toHaveBeenCalledTimes(1);
      expect(mocks.sendPlatformSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+15555550199",
          body: expect.stringContaining("654321"),
        }),
      );
      expect(mocks.dispatchPlatformOtp).not.toHaveBeenCalled();
    });

    it("dispatches BOTH email and SMS when channel is both and user has phone", async () => {
      mocks.getPlatformSettings.mockReturnValue({
        emailNotifications: true,
        smsNotifications: true,
      });

      const result = await requestPlatformPasswordReset("ops@mms.local");

      expect(result.accepted).toBe(true);
      expect(mocks.dispatchPlatformOtp).toHaveBeenCalledTimes(1);
      expect(mocks.sendPlatformSms).toHaveBeenCalledTimes(1);
      expect(mocks.sendPlatformSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+15555550199",
          body: expect.stringContaining("654321"),
        }),
      );
    });
  });

  describe("resendPlatformPasswordReset", () => {
    it("re-dispatches both email and SMS when channel is both", async () => {
      mocks.getPlatformSettings.mockReturnValue({
        emailNotifications: true,
        smsNotifications: true,
      });
      mocks.getAuthArtifact.mockResolvedValue({
        id: "reset-artifact-1",
        kind: "platform_password_reset",
        payload: {
          userId: "p-admin-1",
          email: "ops@mms.local",
          codeHash: "codehash",
          attempts: 0,
        },
      });

      const result = await resendPlatformPasswordReset("reset-artifact-1");

      expect(result.accepted).toBe(true);
      expect(mocks.dispatchPlatformOtp).toHaveBeenCalledTimes(1);
      expect(mocks.sendPlatformSms).toHaveBeenCalledTimes(1);
    });
  });
});
