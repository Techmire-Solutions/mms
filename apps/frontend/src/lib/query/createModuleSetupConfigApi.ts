export interface CreateModuleSetupConfigApiOptions<TPreferences> {
  fetchPreferencesFn: (signal?: AbortSignal) => Promise<TPreferences | null>;
  savePreferencesFn: (prefs: unknown) => Promise<TPreferences>;
  normalizePrefs: (prefs: unknown) => TPreferences;
}

/**
 * Shared Setup preferences REST + memory-cache module.
 * Adapters pass module normalize functions.
 */
export function createModuleSetupConfigApi<TPreferences>({
  fetchPreferencesFn,
  savePreferencesFn,
  normalizePrefs,
}: CreateModuleSetupConfigApiOptions<TPreferences>) {
  let memoryPreferences: TPreferences | null = null;

  function setPreferencesMemory(preferences: TPreferences): void {
    memoryPreferences = normalizePrefs(preferences);
  }

  async function fetchPreferences(signal?: AbortSignal): Promise<TPreferences> {
    const response = await fetchPreferencesFn(signal);
    const normalized = normalizePrefs(response ?? null);
    memoryPreferences = normalized;
    return normalized;
  }

  async function savePreferencesAsync(preferences: TPreferences): Promise<TPreferences> {
    const normalized = normalizePrefs(preferences);
    const response = await savePreferencesFn(normalized);
    const saved = normalizePrefs(response ?? normalized);
    memoryPreferences = saved;
    return saved;
  }

  function getSettingsMemoryFallback(): TPreferences {
    return memoryPreferences ?? normalizePrefs(null);
  }

  return {
    setPreferencesMemory,
    fetchPreferences,
    savePreferencesAsync,
    getSettingsMemoryFallback,
  };
}
