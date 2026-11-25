import { useCallback } from "react";
import {
  DEFAULT_OBLIGATIONS_SETTINGS,
  normalizeObligationsModulePreferences,
  type ObligationsModulePreferences,
  type ObligationsSettings,
} from "@mms/contracts";
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

/**
 * Optimistic local publish: update the memory cache and notify window listeners.
 * Deliberately performs no network write — callers own the server write so an
 * update never hits the API twice (the mutation and the fire-and-forget helper
 * used to race the same PUT).
 */
function publishObligationsSettings(settings: ObligationsSettings): ObligationsModulePreferences {
  const normalized = normalizeObligationsModulePreferences(settings);
  setObligationsPreferencesMemory(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(OBLIGATIONS_SETTINGS_CHANGED_EVENT, { detail: normalized }),
    );
  }
  return normalized;
}

export function loadObligationsSettings(): ObligationsSettings {
  return getObligationsSettingsMemoryFallback();
}

export function saveObligationsSettings(settings: ObligationsSettings): void {
  const normalized = publishObligationsSettings(settings);
  void saveObligationsPreferencesAsync(normalized).catch(() => undefined);
}

export interface UseObligationsSettingsReturn {
  settings: ObligationsSettings;
  updateSettings: (next: ObligationsSettings) => void;
  /** Awaits the server write before updating the local cache (setup footers). */
  updateSettingsAsync: (next: ObligationsSettings) => Promise<void>;
  saving: boolean;
  resetSettings: () => void;
}

export function useObligationsSettings(): UseObligationsSettingsReturn {
  const settings = useComposedObligationsSettings();
  const mutation = useObligationsPreferencesMutation();

  const updateSettings = useCallback(
    (next: ObligationsSettings) => {
      publishObligationsSettings(next);
      mutation.mutate(next);
    },
    [mutation],
  );

  const updateSettingsAsync = useCallback(
    async (next: ObligationsSettings) => {
      await mutation.mutateAsync(next);
      publishObligationsSettings(next);
    },
    [mutation],
  );

  const resetSettings = useCallback(() => {
    publishObligationsSettings(DEFAULT_OBLIGATIONS_SETTINGS);
    mutation.mutate(DEFAULT_OBLIGATIONS_SETTINGS);
  }, [mutation]);

  return {
    settings,
    updateSettings,
    updateSettingsAsync,
    saving: mutation.isPending,
    resetSettings,
  };
}
