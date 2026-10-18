import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEFAULT_GLOBAL_SETTINGS, type GlobalSettings } from "@mms/shared";
import {
  globalSettingsPreviewPatch,
  isEnabledModulesDraftDirty,
  isGlobalPreferencesDirty,
  mergeGlobalSettingsDraft,
  previewGlobalSettingsDraft,
  retainGlobalDraftAfterModulesSave,
  retainModulesDraftAfterGlobalSave,
} from "@/lib/settingsGlobalDraft";

vi.mock("@/lib/db", () => ({
  getGlobalSettings: vi.fn(() => ({
    ...DEFAULT_GLOBAL_SETTINGS,
    enabledModules: { dashboard: true, students: true },
    theme: "system",
  })),
}));

describe("settingsGlobalDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("globalSettingsPreviewPatch excludes enabledModules and theme", () => {
    const draft: GlobalSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      language: "ar",
      timezone: "Asia/Karachi",
      theme: "dark",
      enabledModules: { dashboard: false },
    };
    const patch = globalSettingsPreviewPatch(draft);
    expect(patch.language).toBe("ar");
    expect(patch.timezone).toBe("Asia/Karachi");
    expect(patch).not.toHaveProperty("enabledModules");
    expect(patch).not.toHaveProperty("theme");
  });

  it("mergeGlobalSettingsDraft preserves persisted modules and theme", () => {
    const draft: GlobalSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      language: "ur",
      theme: "dark",
      enabledModules: { dashboard: false },
    };
    const merged = mergeGlobalSettingsDraft(draft);
    expect(merged.language).toBe("ur");
    expect(merged.theme).toBe("system");
    expect(merged.enabledModules.dashboard).toBe(true);
    expect(merged.enabledModules.students).toBe(true);
  });

  it("isGlobalPreferencesDirty ignores module toggles", () => {
    const baseline: GlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS, language: "en" };
    const draft: GlobalSettings = {
      ...baseline,
      language: "ar",
      enabledModules: { ...baseline.enabledModules, faculty: false },
    };
    expect(isGlobalPreferencesDirty(draft, baseline)).toBe(true);
    expect(isEnabledModulesDraftDirty(draft, baseline)).toBe(true);
    const languageOnly: GlobalSettings = { ...baseline, language: "ar" };
    expect(isEnabledModulesDraftDirty(languageOnly, baseline)).toBe(false);
  });

  it("retain draft helpers preserve unsaved sibling fields", () => {
    const persisted: GlobalSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      language: "en",
    };
    const draft: GlobalSettings = {
      ...persisted,
      language: "ar",
      enabledModules: { ...persisted.enabledModules, faculty: false },
    };
    const afterGlobal = retainModulesDraftAfterGlobalSave(persisted, draft);
    expect(afterGlobal.language).toBe("en");
    expect(afterGlobal.enabledModules.faculty).toBe(false);

    const afterModules = retainGlobalDraftAfterModulesSave(persisted, draft);
    expect(afterModules.language).toBe("ar");
    expect(afterModules.enabledModules.faculty).toBe(true);
  });

  it("previewGlobalSettingsDraft includes modules and preferences", () => {
    const draft: GlobalSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      language: "ur",
      enabledModules: { ...DEFAULT_GLOBAL_SETTINGS.enabledModules, faculty: false },
    };
    const patch = previewGlobalSettingsDraft(draft);
    expect(patch.language).toBe("ur");
    expect(patch.enabledModules?.faculty).toBe(false);
    expect(globalSettingsPreviewPatch(draft).enabledModules).toBeUndefined();
  });
});
