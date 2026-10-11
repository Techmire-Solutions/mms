import { STUDENTS_MODULE_MANIFEST, splitStudentsSettingsBlob } from "@mms/shared";
import {
  hydrateModuleSetupCollectionsFromLegacyObjects,
  type LegacySetupHydrateConfig,
} from "./hydrateModuleSetupFromLegacyBackup.js";

/** Legacy document-store Students Setup object keys. */
export const STUDENTS_SETTINGS_OBJECT_KEY = STUDENTS_MODULE_MANIFEST.settingsObjectKey;
export const STUDENTS_COLUMN_PREFS_OBJECT_KEY = STUDENTS_MODULE_MANIFEST.columnPreferencesObjectKey;

/** Legacy Students Setup object keys that must not re-enter the document store after typed hydrate. */
export const STUDENTS_LEGACY_SETUP_OBJECT_KEYS = [
  STUDENTS_SETTINGS_OBJECT_KEY,
  STUDENTS_COLUMN_PREFS_OBJECT_KEY,
] as const;

const STUDENTS_HYDRATE_CONFIG: LegacySetupHydrateConfig = {
  settingsObjectKey: STUDENTS_SETTINGS_OBJECT_KEY,
  columnPreferencesObjectKey: STUDENTS_COLUMN_PREFS_OBJECT_KEY,
  fieldConfigCollection: "student_field_configs",
  modulePrefsCollection: "student_module_preferences",
  columnPrefsCollection: "student_user_column_prefs",
  splitSettingsBlob: splitStudentsSettingsBlob,
};

/**
 * When a full backup only carries legacy `students_settings` / column-prefs objects,
 * populate typed Setup collection arrays so restore does not wipe FORCE-RLS tables empty.
 */
export function hydrateStudentsSetupCollectionsFromLegacyObjects(
  collections: Record<string, unknown[]>,
  objects: Record<string, unknown> | undefined,
): Record<string, unknown[]> {
  return hydrateModuleSetupCollectionsFromLegacyObjects(
    collections,
    objects,
    STUDENTS_HYDRATE_CONFIG,
  );
}
