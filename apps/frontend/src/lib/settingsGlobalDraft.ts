import {
  DEFAULT_GLOBAL_SETTINGS,
  mergeGlobalSettings,
  normalizeDateFormat,
  normalizeEnabledModules,
  normalizePasswordPolicy,
  normalizeSessionTimeout,
  normalizeTimezone,
  type DateFormatId,
  type GlobalSettings,
} from "@mms/contracts";
import { getGlobalSettings } from "@/lib/db";

/** Fields from the global settings draft that participate in live preview. */
export function globalSettingsPreviewPatch(draft: GlobalSettings): Partial<GlobalSettings> {
  return {
    language: draft.language,
    timezone: normalizeTimezone(draft.timezone, DEFAULT_GLOBAL_SETTINGS.timezone),
    dateFormat: normalizeDateFormat(
      draft.dateFormat,
      DEFAULT_GLOBAL_SETTINGS.dateFormat as DateFormatId,
    ),
    emailNotifications: draft.emailNotifications,
    smsNotifications: draft.smsNotifications,
    whatsAppNotifications: draft.whatsAppNotifications,
    twoFactor: draft.twoFactor,
    sessionTimeout: normalizeSessionTimeout(draft.sessionTimeout),
    passwordPolicy: normalizePasswordPolicy(draft.passwordPolicy),
  };
}

/**
 * Fields persisted by the General + AI Assistant tabs. Extends the preview patch
 * with LLM configuration fields — these are excluded from live preview (which must
 * never surface secrets) but still mark the draft dirty and are written on Save.
 * Masked `llmApiKey`/`llmConfigs[].apiKey` values are safe to send: the server's
 * round-trip guard preserves the stored secret for masked keys.
 */
export function globalSettingsSavePatch(draft: GlobalSettings): Partial<GlobalSettings> {
  return {
    ...globalSettingsPreviewPatch(draft),
    llmProvider: draft.llmProvider,
    llmApiKey: draft.llmApiKey,
    llmConfigs: draft.llmConfigs,
  };
}

/** Live-preview patch for global preferences + module visibility. */
export function previewGlobalSettingsDraft(draft: GlobalSettings): Partial<GlobalSettings> {
  return {
    ...globalSettingsPreviewPatch(draft),
    enabledModules: normalizeEnabledModules(draft.enabledModules),
  };
}

export function isGlobalPreferencesDirty(
  globalSettings: GlobalSettings,
  baseline: GlobalSettings,
): boolean {
  return (
    JSON.stringify(globalSettingsSavePatch(globalSettings)) !==
    JSON.stringify(globalSettingsSavePatch(baseline))
  );
}

export function isEnabledModulesDraftDirty(
  globalSettings: GlobalSettings,
  baseline: GlobalSettings,
): boolean {
  return (
    JSON.stringify(normalizeEnabledModules(globalSettings.enabledModules)) !==
    JSON.stringify(normalizeEnabledModules(baseline.enabledModules))
  );
}

/** Merge draft preview fields into persisted global settings for Save. */
export function mergeGlobalSettingsDraft(draft: GlobalSettings): GlobalSettings {
  return mergeGlobalSettings({
    ...getGlobalSettings(),
    ...globalSettingsSavePatch(draft),
  });
}

/** After global prefs save, keep unsaved module toggles in the shared draft. */
export function retainModulesDraftAfterGlobalSave(
  persisted: GlobalSettings,
  draft: GlobalSettings,
): GlobalSettings {
  return mergeGlobalSettings({
    ...persisted,
    enabledModules: normalizeEnabledModules(draft.enabledModules),
  });
}

/** After modules save, keep unsaved global pref edits in the shared draft. */
export function retainGlobalDraftAfterModulesSave(
  persisted: GlobalSettings,
  draft: GlobalSettings,
): GlobalSettings {
  return mergeGlobalSettings({
    ...persisted,
    ...globalSettingsSavePatch(draft),
  });
}
