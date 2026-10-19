import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadGlobalSettings: vi.fn(),
  sendTenantEmail: vi.fn(),
  sendPlatformEmail: vi.fn(),
  sendTenantSms: vi.fn(),
  getContactById: vi.fn(),
}));

vi.mock("../services/globalSettingsService.js", () => ({
  loadGlobalSettings: mocks.loadGlobalSettings,
}));

vi.mock("../services/email/emailService.js", () => ({
  sendTenantEmail: mocks.sendTenantEmail,
}));

vi.mock("../services/platform/platformEmailService.js", () => ({
  sendPlatformEmail: mocks.sendPlatformEmail,
}));

vi.mock("../services/sms/smsService.js", () => ({
  sendTenantSms: mocks.sendTenantSms,
}));

vi.mock("../services/contactService.js", () => ({
  getContactById: mocks.getContactById,
}));

import {
  dispatchTenantPasswordOtp,
  sendTenantWelcomeEmail,
} from "../services/auth/tenantPasswordOtpDispatch.js";
import type { StoredUser } from "../services/auth/userService.js";

const mockUser: StoredUser = {
  id: "u-1",
  email: "teacher@mms.local",
  name: "Teacher One",
  role: "teacher",
  workspaceSubdomain: "demo",
  passwordHash: "hash",
  createdAt: "2026-01-01T00:00:00.000Z",
  loginEmail: "teacher@mms.local",
  contactId: "c-100",
};

describe("tenantPasswordOtpDispatch", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    mocks.loadGlobalSettings.mockReset();
    mocks.sendTenantEmail.mockReset();
    mocks.sendPlatformEmail.mockReset();
    mocks.sendTenantSms.mockReset();
    mocks.getContactById.mockReset();

    mocks.getContactById.mockResolvedValue({ id: "c-100", phone: "+1234567890" });
    mocks.sendTenantEmail.mockResolvedValue({ sent: true });
    mocks.sendPlatformEmail.mockResolvedValue({ sent: true });
    mocks.sendTenantSms.mockResolvedValue({ sent: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("dispatchTenantPasswordOtp", () => {
    it("dispatches only email when only emailNotifications is true", async () => {
      mocks.loadGlobalSettings.mockResolvedValue({
        emailNotifications: true,
        smsNotifications: false,
      });

      await dispatchTenantPasswordOtp("teacher@mms.local", mockUser, "654321");

      expect(mocks.sendTenantEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendTenantEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "teacher@mms.local",
          text: expect.stringContaining("654321"),
        }),
      );
      expect(mocks.sendTenantSms).not.toHaveBeenCalled();
    });

    it("dispatches only SMS when only smsNotifications is true", async () => {
      mocks.loadGlobalSettings.mockResolvedValue({
        emailNotifications: false,
        smsNotifications: true,
      });

      await dispatchTenantPasswordOtp("teacher@mms.local", mockUser, "654321");

      expect(mocks.sendTenantSms).toHaveBeenCalledTimes(1);
      expect(mocks.sendTenantSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+1234567890",
          body: expect.stringContaining("654321"),
        }),
        expect.anything(),
      );
      expect(mocks.sendTenantEmail).not.toHaveBeenCalled();
    });

    it("dispatches BOTH email and SMS when both channels are enabled", async () => {
      mocks.loadGlobalSettings.mockResolvedValue({
        emailNotifications: true,
        smsNotifications: true,
      });

      await dispatchTenantPasswordOtp("teacher@mms.local", mockUser, "654321");

      expect(mocks.sendTenantEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendTenantEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "teacher@mms.local",
          text: expect.stringContaining("654321"),
        }),
      );
      expect(mocks.sendTenantSms).toHaveBeenCalledTimes(1);
      expect(mocks.sendTenantSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+1234567890",
          body: expect.stringContaining("654321"),
        }),
        expect.anything(),
      );
    });

    it("falls back to platform email if tenant email is not configured", async () => {
      mocks.loadGlobalSettings.mockResolvedValue({
        emailNotifications: true,
        smsNotifications: false,
      });
      mocks.sendTenantEmail.mockResolvedValue({ sent: false, reason: "not_configured" });
      mocks.sendPlatformEmail.mockResolvedValue({ sent: true });

      await dispatchTenantPasswordOtp("teacher@mms.local", mockUser, "654321");

      expect(mocks.sendTenantEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendPlatformEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendPlatformEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "teacher@mms.local",
          text: expect.stringContaining("654321"),
        }),
      );
    });
  });

  describe("sendTenantWelcomeEmail", () => {
    it("sends both email and SMS invite when both channels are active and phone is provided", async () => {
      mocks.loadGlobalSettings.mockResolvedValue({
        emailNotifications: true,
        smsNotifications: true,
      });

      const result = await sendTenantWelcomeEmail({
        workspaceSubdomain: "demo",
        email: "invited@mms.local",
        name: "Invited User",
        origin: "https://demo.mms.local",
        phone: "+9876543210",
      });

      expect(result.sent).toBe(true);
      expect(mocks.sendTenantEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendTenantSms).toHaveBeenCalledTimes(1);
      expect(mocks.sendTenantSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+9876543210",
          body: expect.stringContaining("https://demo.mms.local/forgot-password?activate=1"),
        }),
        expect.anything(),
      );
    });

    it("falls back to platform email if tenant email is not configured", async () => {
      mocks.loadGlobalSettings.mockResolvedValue({
        emailNotifications: true,
        smsNotifications: false,
      });
      mocks.sendTenantEmail.mockResolvedValue({ sent: false, reason: "not_configured" });
      mocks.sendPlatformEmail.mockResolvedValue({ sent: true });

      const result = await sendTenantWelcomeEmail({
        workspaceSubdomain: "demo",
        email: "invited@mms.local",
        name: "Invited User",
        origin: "https://demo.mms.local",
      });

      expect(result.sent).toBe(true);
      expect(mocks.sendTenantEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendPlatformEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendPlatformEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "invited@mms.local",
          text: expect.stringContaining("https://demo.mms.local/forgot-password?activate=1"),
        }),
      );
    });

    it("formats link on tenant subdomain when origin is apex localhost", async () => {
      mocks.loadGlobalSettings.mockResolvedValue({
        emailNotifications: true,
        smsNotifications: false,
      });

      const result = await sendTenantWelcomeEmail({
        workspaceSubdomain: "al-noor",
        email: "admin@al-noor.local",
        name: "Admin User",
        origin: "http://localhost:5173",
      });

      expect(result.sent).toBe(true);
      expect(mocks.sendTenantEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@al-noor.local",
          text: expect.stringContaining(
            "http://al-noor.localhost:5173/forgot-password?activate=1&email=admin%40al-noor.local",
          ),
          html: expect.stringContaining(
            'href="http://al-noor.localhost:5173/forgot-password?activate=1&email=admin%40al-noor.local"',
          ),
        }),
      );
    });
  });
});
