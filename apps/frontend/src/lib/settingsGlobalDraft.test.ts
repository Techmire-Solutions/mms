import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEFAULT_GLOBAL_SETTINGS, type GlobalSettings } from "@mms/contracts";
import {
  globalSettingsPreviewPatch,
  globalSettingsSavePatch,
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
    llmProvider: "gemini",
    llmApiKey: "****abcd",
    llmConfigs: [
      {
        id: "persisted-config",
        name: "Persisted",
        provider: "gemini",
        model: "gemini-2.5-flash",
        apiKey: "****1234",
        isDefaultText: true,
      },
    ],
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

  it("globalSettingsSavePatch includes LLM fields that preview excludes", () => {
    const draft: GlobalSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      llmProvider: "openai",
      llmApiKey: "****wxyz",
      llmConfigs: [
        {
          id: "draft-config",
          name: "Draft",
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "****5678",
          isDefaultText: true,
        },
      ],
    };
    const patch = globalSettingsSavePatch(draft);
    expect(patch.llmProvider).toBe("openai");
    expect(patch.llmApiKey).toBe("****wxyz");
    expect(patch.llmConfigs).toHaveLength(1);
    // Live preview must never carry LLM fields/secrets.
    expect(globalSettingsPreviewPatch(draft)).not.toHaveProperty("llmConfigs");
    expect(globalSettingsPreviewPatch(draft)).not.toHaveProperty("llmProvider");
    expect(globalSettingsPreviewPatch(draft)).not.toHaveProperty("llmApiKey");
  });

  it("isGlobalPreferencesDirty is true when only llmConfigs change", () => {
    const baseline: GlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
    const draft: GlobalSettings = {
      ...baseline,
      llmConfigs: [
        {
          id: "draft-config",
          name: "Draft",
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "sk-live",
          isDefaultText: true,
        },
      ],
    };
    expect(isGlobalPreferencesDirty(draft, baseline)).toBe(true);
  });

  it("mergeGlobalSettingsDraft retains draft LLM fields over persisted storage", () => {
    const draft: GlobalSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      language: "en",
      llmProvider: "openai",
      llmApiKey: "****wxyz",
      llmConfigs: [
        {
          id: "draft-config",
          name: "Draft",
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "****5678",
          isDefaultText: true,
        },
      ],
    };
    const merged = mergeGlobalSettingsDraft(draft);
    expect(merged.llmProvider).toBe("openai");
    expect(merged.llmApiKey).toBe("****wxyz");
    expect(merged.llmConfigs).toHaveLength(1);
    expect(merged.llmConfigs[0]?.id).toBe("draft-config");
    // Persisted-only fields still come from storage, not the draft.
    expect(merged.theme).toBe("system");
    expect(merged.enabledModules.dashboard).toBe(true);
  });

  it("retainGlobalDraftAfterModulesSave keeps unsaved LLM edits", () => {
    const persisted: GlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS, language: "en" };
    const draft: GlobalSettings = {
      ...persisted,
      llmConfigs: [
        {
          id: "draft-config",
          name: "Draft",
          provider: "anthropic",
          model: "claude-3-5-haiku-20241022",
          apiKey: "sk-live",
          isDefaultText: true,
        },
      ],
    };
    const afterModules = retainGlobalDraftAfterModulesSave(persisted, draft);
    expect(afterModules.llmConfigs).toHaveLength(1);
    expect(afterModules.llmConfigs[0]?.id).toBe("draft-config");
  });
});
