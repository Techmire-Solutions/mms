import { describe, expect, it } from "vitest";
import {
  normalizeFacultyModulePreferences,
  normalizeFacultySettings,
  FACULTY_MODULE_PREFERENCE_KEYS,
} from "./facultySetupConfigTypes.js";
import { DEFAULT_FACULTY_SETTINGS } from "./facultyModuleSettings.js";
import { DEFAULT_FACULTY_SPECIALIZATION } from "./facultyTypes.js";

describe("facultySetupConfigTypes prefs SSOT", () => {
  it("omits defaultViewLayout from preference keys and normalize output", () => {
    expect(FACULTY_MODULE_PREFERENCE_KEYS).not.toContain("defaultViewLayout");
    const prefs = normalizeFacultyModulePreferences({
      idPrefix: "FAC",
      defaultViewLayout: "cards",
    } as never);
    expect(prefs).toEqual({
      idPrefix: "FAC",
      // Employee-ID preferences joined the SSOT after this test was written.
      idTemplate: DEFAULT_FACULTY_SETTINGS.idTemplate,
      idDigits: DEFAULT_FACULTY_SETTINGS.idDigits,
      idStartSeq: DEFAULT_FACULTY_SETTINGS.idStartSeq,
      idRestartAnnually: DEFAULT_FACULTY_SETTINGS.idRestartAnnually,
      autoGenerateId: DEFAULT_FACULTY_SETTINGS.autoGenerateId,
      requireContactLink: DEFAULT_FACULTY_SETTINGS.requireContactLink,
      defaultSpecialization: DEFAULT_FACULTY_SETTINGS.defaultSpecialization,
      employeeIdPrefix: DEFAULT_FACULTY_SETTINGS.employeeIdPrefix,
      employeeIdYearFormat: DEFAULT_FACULTY_SETTINGS.employeeIdYearFormat,
      employeeIdSequenceDigits: DEFAULT_FACULTY_SETTINGS.employeeIdSequenceDigits,
      employeeIdDelimiter: DEFAULT_FACULTY_SETTINGS.employeeIdDelimiter,
      employeeIdLastYear: DEFAULT_FACULTY_SETTINGS.employeeIdLastYear,
      employeeIdCurrentSequence: DEFAULT_FACULTY_SETTINGS.employeeIdCurrentSequence,
    });
    expect("defaultViewLayout" in prefs).toBe(false);
  });

  it("strips legacy defaultViewLayout from normalizeFacultySettings", () => {
    const settings = normalizeFacultySettings({
      idPrefix: "FAC",
      defaultViewLayout: "cards",
      defaultSpecialization: DEFAULT_FACULTY_SPECIALIZATION,
    });
    expect(
      (settings as typeof settings & { defaultViewLayout?: unknown }).defaultViewLayout,
    ).toBeUndefined();
    expect(settings.defaultSpecialization).toBe(DEFAULT_FACULTY_SPECIALIZATION);
  });

  it("strips legacy customFields[] from normalizeFacultySettings", () => {
    const settings = normalizeFacultySettings({
      idPrefix: "FAC",
      customFields: [{ id: "house", label: "House" }],
    });
    expect("customFields" in settings).toBe(false);
    expect(typeof settings.fields).toBe("object");
    expect(Array.isArray(settings.fields?.basic)).toBe(true);
  });

  it("derives idTemplate from sequence prefix, year format, and delimiter", () => {
    const prefs = normalizeFacultyModulePreferences({
      employeeIdPrefix: "PROF",
      employeeIdYearFormat: "YY",
      employeeIdDelimiter: "-",
    });
    expect(prefs.idPrefix).toBe("PROF");
    expect(prefs.idTemplate).toBe("{PREFIX}-{YY}-{SEQ}");
  });

  it("forces requireContactLink true even when a stored false is present", () => {
    const prefs = normalizeFacultyModulePreferences({ requireContactLink: false });
    expect(prefs.requireContactLink).toBe(true);
    const settings = normalizeFacultySettings({ requireContactLink: false });
    expect(settings.requireContactLink).toBe(true);
  });
});
