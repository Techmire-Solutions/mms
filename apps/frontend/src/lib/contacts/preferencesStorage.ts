import {
  normalizeContactPreferences,
  CONTACTS_MODULE_MANIFEST,
  type ContactPreferences,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

const PREFERENCES_API = `${CONTACTS_MODULE_MANIFEST.restBasePath}/preferences`;
const LEGACY_LOCAL_PREFERENCES_KEY = "mms_contact_preferences";

let memoryPreferences: ContactPreferences | null = null;

function parseLegacyLocalPreferences(): Partial<ContactPreferences> {
  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_PREFERENCES_KEY);
    return raw ? (JSON.parse(raw) as Partial<ContactPreferences>) : {};
  } catch {
    return {};
  }
}

/**
 * Synchronous read — returns last hydrated server preferences in memory,
 * or falls back to system defaults with one-shot legacy local migration.
 */
export function loadPreferences(): ContactPreferences {
  if (memoryPreferences) return memoryPreferences;
  const fromLocal = parseLegacyLocalPreferences();
  return normalizeContactPreferences(fromLocal);
}

export function setPreferencesMemory(preferences: ContactPreferences): void {
  memoryPreferences = preferences;
  try {
    localStorage.removeItem(LEGACY_LOCAL_PREFERENCES_KEY);
  } catch {
    // Ignore storage errors in restricted/SSR environments
  }
}

/**
 * Fetches contact preferences from `/api/contacts/preferences` and updates in-memory cache.
 */
export async function fetchPreferences(signal?: AbortSignal): Promise<ContactPreferences> {
  const response = await apiJson<{ preferences: ContactPreferences }>(PREFERENCES_API, { signal });
  const normalized = normalizeContactPreferences(response.preferences ?? null);
  setPreferencesMemory(normalized);
  return normalized;
}

/**
 * Optimistic local write — does not hit the server. Prefer `savePreferencesAsync`.
 */
export function savePreferences(preferences: ContactPreferences): void {
  setPreferencesMemory(preferences);
}

/**
 * Persists contact preferences via PUT `/api/contacts/preferences` and updates memory cache.
 */
export async function savePreferencesAsync(
  preferences: ContactPreferences,
): Promise<ContactPreferences> {
  const normalized = normalizeContactPreferences(preferences);
  const response = await apiJson<{ success: boolean; preferences: ContactPreferences }>(
    PREFERENCES_API,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    },
  );
  const saved = normalizeContactPreferences(response.preferences ?? normalized);
  setPreferencesMemory(saved);
  return saved;
}
