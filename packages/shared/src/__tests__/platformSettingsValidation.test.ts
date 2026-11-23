import { describe, it, expect } from "vitest";
import {
  platformSettingsUpdateSchema,
  migrateAndRestartSchema,
  MIGRATE_AND_RESTART_CONFIRM,
  resolvePlatformNotificationChannel,
  DEFAULT_PLATFORM_SETTINGS,
  mergePlatformSettings,
} from "../auth/platformSettingsTypes.js";
import { resolveNotificationChannel } from "../settings/globalSettingsNotificationUtils.js";
import { DEFAULT_GLOBAL_SETTINGS } from "../settings/globalSettingsCore.js";
import { platformActivityLogsQuerySchema } from "../schemas/platform.dto.js";

describe("platformSettingsValidation", () => {
  describe("platformActivityLogsQuerySchema", () => {
    it("applies defaults for empty query", () => {
      const parsed = platformActivityLogsQuerySchema.parse({});
      expect(parsed).toEqual({ limit: 50, offset: 0 });
    });

    it("coerces and clamps valid query parameters", () => {
      const parsed = platformActivityLogsQuerySchema.parse({ limit: "25", offset: "10" });
      expect(parsed).toEqual({ limit: 25, offset: 10 });
    });

    it("rejects out-of-range limit and negative offset", () => {
      expect(platformActivityLogsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
      expect(platformActivityLogsQuerySchema.safeParse({ limit: "201" }).success).toBe(false);
      expect(platformActivityLogsQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
    });
  });

  describe("platformSettingsUpdateSchema", () => {
    it("validates correct update payloads", () => {
      const valid = {
        syncTlsOnCreate: true,
        tlsExtraSans: "*.madrasa.com",
        certbotEmail: "admin@madrasa.com",
      };
      const result = platformSettingsUpdateSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(valid);
      }
    });

    it("accepts empty certbot email or empty payload", () => {
      const emptyEmail = { certbotEmail: "" };
      const emptyPayload = {};

      expect(platformSettingsUpdateSchema.safeParse(emptyEmail).success).toBe(true);
      expect(platformSettingsUpdateSchema.safeParse(emptyPayload).success).toBe(true);
    });

    it("rejects invalid email format", () => {
      const invalid = { certbotEmail: "not-an-email" };
      const result = platformSettingsUpdateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("migrateAndRestartSchema", () => {
    it("accepts exact confirmation string with password", () => {
      const valid = { confirm: MIGRATE_AND_RESTART_CONFIRM, password: "secret" };
      const result = migrateAndRestartSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects missing password", () => {
      const invalid = { confirm: MIGRATE_AND_RESTART_CONFIRM };
      const result = migrateAndRestartSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects invalid confirmation string", () => {
      const invalid = { confirm: "RESTART", password: "secret" };
      const result = migrateAndRestartSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects unknown keys (strict)", () => {
      const invalid = {
        confirm: MIGRATE_AND_RESTART_CONFIRM,
        password: "secret",
        extra: true,
      };
      const result = migrateAndRestartSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("resolvePlatformNotificationChannel & resolveNotificationChannel", () => {
    it("returns 'both' when both email and sms notifications are enabled", () => {
      expect(
        resolvePlatformNotificationChannel({
          ...DEFAULT_PLATFORM_SETTINGS,
          emailNotifications: true,
          smsNotifications: true,
        }),
      ).toBe("both");

      expect(
        resolveNotificationChannel({
          ...DEFAULT_GLOBAL_SETTINGS,
          emailNotifications: true,
          smsNotifications: true,
        }),
      ).toBe("both");
    });

    it("returns 'email' when only email notifications are enabled", () => {
      expect(
        resolvePlatformNotificationChannel({
          ...DEFAULT_PLATFORM_SETTINGS,
          emailNotifications: true,
          smsNotifications: false,
        }),
      ).toBe("email");

      expect(
        resolveNotificationChannel({
          ...DEFAULT_GLOBAL_SETTINGS,
          emailNotifications: true,
          smsNotifications: false,
        }),
      ).toBe("email");
    });

    it("returns 'sms' when only sms notifications are enabled", () => {
      expect(
        resolvePlatformNotificationChannel({
          ...DEFAULT_PLATFORM_SETTINGS,
          emailNotifications: false,
          smsNotifications: true,
        }),
      ).toBe("sms");

      expect(
        resolveNotificationChannel({
          ...DEFAULT_GLOBAL_SETTINGS,
          emailNotifications: false,
          smsNotifications: true,
        }),
      ).toBe("sms");
    });

    it("returns 'none' when neither email nor sms notifications are enabled", () => {
      expect(
        resolvePlatformNotificationChannel({
          ...DEFAULT_PLATFORM_SETTINGS,
          emailNotifications: false,
          smsNotifications: false,
        }),
      ).toBe("none");

      expect(
        resolveNotificationChannel({
          ...DEFAULT_GLOBAL_SETTINGS,
          emailNotifications: false,
          smsNotifications: false,
        }),
      ).toBe("none");
    });
  });
});

describe("platformSettings extended fields", () => {
  it("merges stored settings with defaults for legacy shapes", () => {
    const merged = mergePlatformSettings({ id: "global", certbotEmail: "a@b.test" });
    expect(merged.timezone).toBe("UTC");
    expect(merged.dateFormat).toBe("DD/MM/YYYY");
    expect(merged.themeMode).toBe("system");
    expect(merged.disabledModules).toEqual([]);
    expect(merged.idleSessionMinutes).toBe(30);
    expect(merged.llmProvider).toBe("none");
    expect(merged.emailNotifications).toBe(true);
  });

  it("accepts the extended update payload", () => {
    const parsed = platformSettingsUpdateSchema.safeParse({
      timezone: "Asia/Karachi",
      dateFormat: "YYYY-MM-DD",
      themeMode: "dark",
      idleSessionMinutes: 45,
      disabledModules: ["finance"],
      defaultEnabledModules: { tasks: false },
      llmProvider: "openai",
      llmApiKey: "****abcd",
      llmConfigs: [
        {
          id: "c1",
          name: "Primary",
          provider: "openai",
          apiKey: "****abcd",
          model: "gpt-4o-mini",
          isDefaultText: true,
        },
      ],
      whatsAppNotifications: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid regional/security values and unknown module ids", () => {
    expect(platformSettingsUpdateSchema.safeParse({ timezone: "Not/AZone" }).success).toBe(false);
    expect(platformSettingsUpdateSchema.safeParse({ dateFormat: "YYYY" }).success).toBe(false);
    expect(platformSettingsUpdateSchema.safeParse({ themeMode: "sepia" }).success).toBe(false);
    expect(platformSettingsUpdateSchema.safeParse({ idleSessionMinutes: 1 }).success).toBe(false);
    expect(platformSettingsUpdateSchema.safeParse({ disabledModules: ["nope"] }).success).toBe(
      false,
    );
  });
});
