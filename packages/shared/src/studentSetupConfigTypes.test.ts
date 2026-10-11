import { describe, expect, it } from "vitest";
import {
  composeStudentsSettings,
  defaultStudentEnabledTabIds,
  mergeStudentsFormTabsFromApi,
  normalizeStudentModulePreferences,
  resolveStudentEnabledTabIds,
  splitStudentsSettingsBlob,
  stripStudentFieldConfigForPersist,
} from "./studentSetupConfigTypes.js";
import { STUDENT_TAB_REGISTRY } from "./moduleFieldSetupPersons.js";

describe("normalizeStudentModulePreferences", () => {
  it("returns defaults for null/empty", () => {
    expect(normalizeStudentModulePreferences(null)).toEqual({
      autoGenerateId: true,
      grNumberTemplate: "{seq}-{year}",
      grNumberDigits: 4,
      grNumberRestartAnnually: true,
    });
  });

  it("keeps valid overrides", () => {
    expect(
      normalizeStudentModulePreferences({
        autoGenerateId: false,
        grNumberTemplate: "GR-{seq}",
        grNumberDigits: 6,
        grNumberRestartAnnually: false,
      }),
    ).toEqual({
      autoGenerateId: false,
      grNumberTemplate: "GR-{seq}",
      grNumberDigits: 6,
      grNumberRestartAnnually: false,
    });
  });

  it("preserves fine-grained sequence numbering configuration", () => {
    expect(
      normalizeStudentModulePreferences({
        autoGenerateId: true,
        grNumberTemplate: "STD-{seq}-{year}",
        grNumberDigits: 5,
        grNumberRestartAnnually: true,
        grNumberPrefix: "STD",
        grNumberYearFormat: "YYYY",
        grNumberDelimiter: "-",
        grNumberStartSeq: 100,
        grNumberRolloverPolicy: "annual_calendar",
      }),
    ).toEqual({
      autoGenerateId: true,
      grNumberTemplate: "STD-{seq}-{year}",
      grNumberDigits: 5,
      grNumberRestartAnnually: true,
      grNumberPrefix: "STD",
      grNumberYearFormat: "YYYY",
      grNumberDelimiter: "-",
      grNumberStartSeq: 100,
      grNumberRolloverPolicy: "annual_calendar",
    });
  });
});

describe("splitStudentsSettingsBlob / stripStudentFieldConfigForPersist", () => {
  it("splits GR prefs from field-config and never persists formTabs", () => {
    const { fieldConfig, preferences } = splitStudentsSettingsBlob({
      autoGenerateId: false,
      grNumberTemplate: "S-{seq}",
      grNumberDigits: 3,
      grNumberRestartAnnually: false,
      enabledTabs: ["registration"],
      formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 0 }],
      fields: { registration: [] },
    });
    expect(preferences).toEqual({
      autoGenerateId: false,
      grNumberTemplate: "S-{seq}",
      grNumberDigits: 3,
      grNumberRestartAnnually: false,
    });
    expect(fieldConfig.formTabs).toBeUndefined();
    expect(fieldConfig.autoGenerateId).toBeUndefined();
    expect(fieldConfig.grNumberTemplate).toBeUndefined();
    expect(fieldConfig.enabledTabs).toEqual(["registration"]);

    const stripped = stripStudentFieldConfigForPersist({
      ...preferences,
      formTabs: STUDENT_TAB_REGISTRY,
      enabledTabs: ["basic"],
    });
    expect(stripped.formTabs).toBeUndefined();
    expect(stripped.autoGenerateId).toBeUndefined();
  });
});

describe("composeStudentsSettings", () => {
  it("merges field-config + preferences into StudentsSettings", () => {
    const settings = composeStudentsSettings(
      { enabledTabs: ["registration"], version: 4 },
      { autoGenerateId: false, grNumberTemplate: "X-{seq}", grNumberDigits: 2 },
    );
    expect(settings.autoGenerateId).toBe(false);
    expect(settings.grNumberTemplate).toBe("X-{seq}");
    expect(settings.grNumberDigits).toBe(2);
    expect(settings.enabledTabs).toContain("registration");
  });
});

describe("resolveStudentEnabledTabIds", () => {
  it("falls back to registry defaults when settings are absent or empty", () => {
    expect(resolveStudentEnabledTabIds()).toEqual(defaultStudentEnabledTabIds());
    expect(resolveStudentEnabledTabIds(null)).toEqual(defaultStudentEnabledTabIds());
    expect(resolveStudentEnabledTabIds({})).toEqual(defaultStudentEnabledTabIds());
    expect(resolveStudentEnabledTabIds({ enabledTabs: [] })).toEqual(defaultStudentEnabledTabIds());
  });

  it("uses non-empty enabledTabs and always includes locked basic", () => {
    expect(resolveStudentEnabledTabIds({ enabledTabs: ["registration"] })).toEqual(
      expect.arrayContaining(["basic", "registration"]),
    );
    expect(resolveStudentEnabledTabIds({ enabledTabs: ["basic", "registration"] })).toEqual(
      expect.arrayContaining(["basic", "registration"]),
    );
  });

  it("prefers formTabs.enabled over enabledTabs when formTabs are present", () => {
    const formTabs = [
      { key: "basic", label: "Identity", enabled: true, order: 0 },
      { key: "registration", label: "Registration", enabled: false, order: 1 },
      { key: "custom_house", label: "House", enabled: true, order: 2 },
    ];
    const resolved = resolveStudentEnabledTabIds({
      formTabs,
      enabledTabs: ["basic", "registration"],
    });
    expect(resolved).toEqual(expect.arrayContaining(["basic", "custom_house"]));
    expect(resolved).not.toContain("registration");
  });

  it("always includes locked basic even when formTabs omit or disable it", () => {
    const formTabs = [
      { key: "basic", label: "Identity", enabled: false, order: 0 },
      { key: "registration", label: "Registration", enabled: true, order: 1 },
    ];
    expect(resolveStudentEnabledTabIds({ formTabs })).toEqual(
      expect.arrayContaining(["basic", "registration"]),
    );
  });
});

describe("mergeStudentsFormTabsFromApi", () => {
  it("falls back to registry when API empty and document empty", () => {
    expect(mergeStudentsFormTabsFromApi(undefined, []).map((tab) => tab.key)).toEqual(
      STUDENT_TAB_REGISTRY.map((tab) => tab.key),
    );
  });

  it("prefers API tabs and appends missing seed tabs", () => {
    const merged = mergeStudentsFormTabsFromApi(STUDENT_TAB_REGISTRY, [
      { key: "custom_foo", label: "Foo", enabled: true, order: 2 },
    ]);
    expect(merged.map((tab) => tab.key)).toEqual([
      "custom_foo",
      ...STUDENT_TAB_REGISTRY.map((tab) => tab.key),
    ]);
  });
});
