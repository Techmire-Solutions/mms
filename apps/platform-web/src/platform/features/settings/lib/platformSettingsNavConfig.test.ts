import { describe, expect, it } from "vitest";
import {
  PLATFORM_SETTINGS_NAV,
  PLATFORM_SETTINGS_SECTIONS,
  isPlatformSettingsSection,
  parsePlatformSettingsSection,
} from "@/platform/features/settings/lib/platformSettingsNavConfig";
import { PLATFORM_SETTINGS_SECTION_COMPONENTS } from "@/platform/features/settings/lib/platformSettingsSectionComponents";

describe("platform settings registry", () => {
  it("keeps nav, section ids, and lazy components in sync", () => {
    expect(PLATFORM_SETTINGS_NAV.map((item) => item.id)).toEqual([...PLATFORM_SETTINGS_SECTIONS]);
    expect(Object.keys(PLATFORM_SETTINGS_SECTION_COMPONENTS)).toEqual([
      ...PLATFORM_SETTINGS_SECTIONS,
    ]);
  });

  it("parses canonical and legacy sections", () => {
    expect(parsePlatformSettingsSection("branding")).toBe("branding");
    expect(parsePlatformSettingsSection("notifications")).toBe("global");
    expect(parsePlatformSettingsSection("security")).toBe("global");
    expect(parsePlatformSettingsSection("unknown")).toBe("global");
    expect(parsePlatformSettingsSection(null)).toBe("global");
    expect(isPlatformSettingsSection("modules")).toBe(true);
    expect(isPlatformSettingsSection("security")).toBe(false);
  });
});
