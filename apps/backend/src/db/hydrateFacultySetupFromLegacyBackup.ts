import { FACULTY_MODULE_MANIFEST, splitFacultySettingsBlob } from "@mms/shared";
import {
  hydrateModuleSetupCollectionsFromLegacyObjects,
  type LegacySetupHydrateConfig,
} from "./hydrateModuleSetupFromLegacyBackup.js";

/** Canonical document-store Faculty Setup object keys. */
export const FACULTY_SETTINGS_OBJECT_KEY = FACULTY_MODULE_MANIFEST.settingsObjectKey;
export const FACULTY_COLUMN_PREFS_OBJECT_KEY = FACULTY_MODULE_MANIFEST.columnPreferencesObjectKey;

/** Faculty Setup object keys that must not re-enter the document store after typed hydrate. */
export const FACULTY_LEGACY_SETUP_OBJECT_KEYS = [
  FACULTY_SETTINGS_OBJECT_KEY,
  FACULTY_COLUMN_PREFS_OBJECT_KEY,
  "faculty_field_config",
] as const;

/**
 * When a full backup carries modern `faculty_settings` objects, populates typed Setup collection
 * arrays so restore does not wipe FORCE-RLS tables empty.
 *
 * @param {Record<string, unknown[]>} collections - Raw backup collection maps.
 * @param {Record<string, unknown> | undefined} objects - Raw backup key-value object store.
 * @returns {Record<string, unknown[]>} Normalized collections containing typed faculty records.
 */
export function hydrateFacultySetupCollectionsFromLegacyObjects(
  collections: Record<string, unknown[]>,
  objects: Record<string, unknown> | undefined,
): Record<string, unknown[]> {
  if (!Array.isArray(collections.users) || !objects) return collections;

  const config: LegacySetupHydrateConfig = {
    settingsObjectKey: FACULTY_SETTINGS_OBJECT_KEY,
    columnPreferencesObjectKey: FACULTY_COLUMN_PREFS_OBJECT_KEY,
    fieldConfigCollection: "faculty_field_configs",
    modulePrefsCollection: "faculty_module_preferences",
    columnPrefsCollection: "faculty_user_column_prefs",
    splitSettingsBlob: splitFacultySettingsBlob,
  };

  return hydrateModuleSetupCollectionsFromLegacyObjects({ ...collections }, objects, config);
}
