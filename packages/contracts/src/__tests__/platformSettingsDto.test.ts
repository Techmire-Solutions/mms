import { describe, expect, it } from "vitest";
import { platformSettingsDtoSchema } from "../schemas/platform.dto.js";
import { DEFAULT_PLATFORM_SETTINGS } from "../auth/platformSettingsTypes.js";

describe("platformSettingsDtoSchema", () => {
  it("parses the full settings shape returned by the settings service", () => {
    const parsed = platformSettingsDtoSchema.safeParse({
      ...DEFAULT_PLATFORM_SETTINGS,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts the default settings shape", () => {
    const parsed = platformSettingsDtoSchema.safeParse({
      ...DEFAULT_PLATFORM_SETTINGS,
      updatedAt: undefined,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown keys (strict)", () => {
    const parsed = platformSettingsDtoSchema.safeParse({
      ...DEFAULT_PLATFORM_SETTINGS,
      billingPlan: "premium",
    });
    expect(parsed.success).toBe(false);
  });

  it("covers the settings fields the platform panels edit", () => {
    const shape = Object.keys(platformSettingsDtoSchema.shape);
    expect(shape).toEqual(
      expect.arrayContaining([
        "emailNotifications",
        "smsNotifications",
        "whatsAppNotifications",
        "timezone",
        "dateFormat",
        "themeMode",
        "defaultEnabledModules",
        "disabledModules",
        "llmProvider",
        "llmApiKey",
        "llmConfigs",
        "idleSessionMinutes",
      ]),
    );
  });
});
