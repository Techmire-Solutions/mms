import { describe, expect, it } from "vitest";
import type { ContactPreferences } from "@mms/contracts";
import { DEFAULT_CONTACT_PREFERENCES } from "@mms/contracts";
import { getDuplicateThemeColors } from "../lib/duplicateDetectionTypes";

describe("getDuplicateThemeColors", () => {
  it("returns the default highlight color when no preferences are provided", () => {
    expect(getDuplicateThemeColors()).toEqual({
      highlightBg: DEFAULT_CONTACT_PREFERENCES.duplicateDetectionColorHighlight,
    });
  });

  it("honours a custom highlight color override", () => {
    const prefs: Partial<ContactPreferences> = { duplicateDetectionColorHighlight: "#ff0000" };
    expect(getDuplicateThemeColors(prefs)).toEqual({ highlightBg: "#ff0000" });
  });

  it("does not mutate the default preferences", () => {
    const before = DEFAULT_CONTACT_PREFERENCES.duplicateDetectionColorHighlight;
    getDuplicateThemeColors({ duplicateDetectionColorHighlight: "#00ff00" });
    expect(DEFAULT_CONTACT_PREFERENCES.duplicateDetectionColorHighlight).toBe(before);
  });
});
