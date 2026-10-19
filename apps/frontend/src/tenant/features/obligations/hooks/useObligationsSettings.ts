import { useCallback } from "react";
import {
  DEFAULT_OBLIGATIONS_SETTINGS,
  normalizeObligationsModulePreferences,
  type ObligationsSettings,
} from "@mms/shared";
import {
  useComposedObligationsSettings,
  useObligationsPreferencesMutation,
} from "./useObligationsSetupConfig";
import {
  getObligationsSettingsMemoryFallback,
  setObligationsPreferencesMemory,
  saveObligationsPreferencesAsync,
} from "./obligationsSetupConfigApi";

export const OBLIGATIONS_SETTINGS_CHANGED_EVENT = "mms:obligations-settings-changed";

export function loadObligationsSettings(): ObligationsSettings {
  return getObligationsSettingsMemoryFallback();
}

export function saveObligationsSettings(settings: ObligationsSettings): void {
  const normalized = normalizeObligationsModulePreferences(settings);
  setObligationsPreferencesMemory(normalized);
  void saveObligationsPreferencesAsync(normalized).catch(() => undefined);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OBLIGATIONS_SETTINGS_CHANGED_EVENT, { detail: normalized }));
  }
}

export interface UseObligationsSettingsReturn {
  settings: ObligationsSettings;
  updateSettings: (next: ObligationsSettings) => void;
  resetSettings: () => void;
}

export function useObligationsSettings(): UseObligationsSettingsReturn {
  const settings = useComposedObligationsSettings();
  const mutation = useObligationsPreferencesMutation();

  const updateSettings = useCallback(
    (next: ObligationsSettings) => {
      saveObligationsSettings(next);
      mutation.mutate(next);
    },
    [mutation],
  );

  const resetSettings = useCallback(() => {
    saveObligationsSettings(DEFAULT_OBLIGATIONS_SETTINGS);
    mutation.mutate(DEFAULT_OBLIGATIONS_SETTINGS);
  }, [mutation]);

  return { settings, updateSettings, resetSettings };
}
