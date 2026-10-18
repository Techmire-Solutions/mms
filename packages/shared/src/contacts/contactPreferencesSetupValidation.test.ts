import { describe, expect, it } from "vitest";
import { DEFAULT_CONTACT_PREFERENCES } from "./contactPreferenceDefaults.js";
import {
  normalizeContactDialCode,
  prepareContactPreferencesSetupSave,
} from "./contactPreferencesSetupValidation.js";

describe("normalizeContactDialCode", () => {
  it("adds leading + and strips spaces", () => {
    expect(normalizeContactDialCode("92")).toBe("+92");
    expect(normalizeContactDialCode("+92")).toBe("+92");
    expect(normalizeContactDialCode(" +1  ")).toBe("+1");
    expect(normalizeContactDialCode("")).toBe("");
  });
});

describe("prepareContactPreferencesSetupSave", () => {
  it("accepts valid prefs and normalizes country codes", () => {
    const result = prepareContactPreferencesSetupSave(DEFAULT_CONTACT_PREFERENCES, [
      { country: "pakistan", code: "92" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.countryCodes).toEqual([{ country: "Pakistan", code: "+92" }]);
  });

  it("rejects threshold order when high is not greater than medium", () => {
    const result = prepareContactPreferencesSetupSave(
      {
        ...DEFAULT_CONTACT_PREFERENCES,
        duplicateDetectionThresholdHigh: 70,
        duplicateDetectionThresholdMedium: 80,
      },
      [{ country: "Pakistan", code: "+92" }],
    );
    expect(result).toEqual({ ok: false, issue: "thresholdOrder" });
  });

  it("rejects empty or incomplete country rows", () => {
    expect(
      prepareContactPreferencesSetupSave(DEFAULT_CONTACT_PREFERENCES, [{ country: "", code: "" }]),
    ).toEqual({ ok: false, issue: "emptyCountryRow" });
    expect(
      prepareContactPreferencesSetupSave(DEFAULT_CONTACT_PREFERENCES, [
        { country: "Pakistan", code: "" },
      ]),
    ).toEqual({ ok: false, issue: "emptyCountryRow" });
  });

  it("rejects duplicate country names", () => {
    const result = prepareContactPreferencesSetupSave(DEFAULT_CONTACT_PREFERENCES, [
      { country: "Pakistan", code: "+92" },
      { country: "pakistan", code: "+93" },
    ]);
    expect(result).toEqual({ ok: false, issue: "duplicateCountry" });
  });

  it("normalizes name prefixes to lowercase trimmed list", () => {
    const result = prepareContactPreferencesSetupSave(
      {
        ...DEFAULT_CONTACT_PREFERENCES,
        namePrefixesToIgnore: [" Syed ", "SYEDA", ""],
      },
      [{ country: "Pakistan", code: "+92" }],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prefs.namePrefixesToIgnore).toEqual(["syed", "syeda"]);
  });
});
