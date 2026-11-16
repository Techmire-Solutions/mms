import { describe, expect, it } from "vitest";
import { platformSettingsDtoSchema } from "../schemas/platform.dto.js";
import { DEFAULT_PLATFORM_SETTINGS } from "../auth/platformSettingsTypes.js";

describe("platformSettingsDtoSchema", () => {
  it("parses the full settings shape returned by the settings service", () => {
    const parsed = platformSettingsDtoSchema.safeParse({
      id: "global",
      syncTlsOnCreate: true,
      tlsExtraSans: "",
      certbotEmail: "ops@example.org",
      emailNotifications: true,
      smsNotifications: false,
      whatsAppNotifications: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts the default settings shape (whatsAppNotifications omitted)", () => {
    const parsed = platformSettingsDtoSchema.safeParse({
      ...DEFAULT_PLATFORM_SETTINGS,
      updatedAt: undefined,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown keys (strict)", () => {
    const parsed = platformSettingsDtoSchema.safeParse({
      id: "global",
      syncTlsOnCreate: true,
      tlsExtraSans: "",
      certbotEmail: "",
      emailNotifications: true,
      smsNotifications: false,
      billingPlan: "premium",
    });
    expect(parsed.success).toBe(false);
  });

  it("covers the notification channel fields the UI toggles", () => {
    const shape = Object.keys(platformSettingsDtoSchema.shape);
    expect(shape).toEqual(
      expect.arrayContaining(["emailNotifications", "smsNotifications", "whatsAppNotifications"]),
    );
  });
});
