import type { AppLanguageCode } from "./languageUtils.js";

interface StoredGlobalSettings {
  dateFormat: string;
  timezone: string;
  language: AppLanguageCode;
}

const DEFAULT_STORED_GLOBAL_SETTINGS: StoredGlobalSettings = {
  dateFormat: "DD/MM/YYYY",
  timezone: "UTC",
  language: "en",
};

let settingsProvider: (() => StoredGlobalSettings) | null = null;

/**
 * Registers an external settings provider to override `getStoredGlobalSettings` calls.
 * Pass `null` to clear a previously registered provider.
 * The frontend injects reactive/preview settings; `@mms/shared` never reads
 * localStorage itself, so it stays environment-agnostic.
 */
export function registerSettingsProvider(
  provider: (() => StoredGlobalSettings) | null,
): void {
  settingsProvider = provider;
}

/**
 * Retrieves the global settings from the registered provider, falling back to
 * pure defaults when none is registered (safe for server rendering).
 */
export function getStoredGlobalSettings(): StoredGlobalSettings {
  if (settingsProvider) {
    try {
      return settingsProvider();
    } catch {
      // Fall back to defaults if the provider fails
    }
  }

  return { ...DEFAULT_STORED_GLOBAL_SETTINGS };
}
