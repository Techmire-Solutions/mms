/**
 * Generic legacy-setup hydration. When a full backup only carries the legacy
 * `{module}_settings` / column-prefs document-store objects, populate the typed
 * Setup collection arrays so restore does not wipe FORCE-RLS tables empty.
 *
 * Shared by Students / Teachers (and any future Setup-migrated module). Per-module
 * wrappers build a {@link LegacySetupHydrateConfig} from their manifest + split fn.
 */
export interface LegacySetupHydrateConfig {
  /** Legacy document-store settings object key (manifest `settingsObjectKey`). */
  settingsObjectKey: string;
  /** Legacy per-user column-prefs object key (manifest `columnPreferencesObjectKey`). */
  columnPreferencesObjectKey: string;
  /** Typed relational collection holding field-config rows. */
  fieldConfigCollection: string;
  /** Typed relational collection holding module-preferences rows. */
  modulePrefsCollection: string;
  /** Typed relational collection holding per-user column-prefs rows. */
  columnPrefsCollection: string;
  /** Splits the legacy settings blob into `{ fieldConfig, preferences }`. */
  splitSettingsBlob: (raw: Record<string, unknown>) => {
    fieldConfig: unknown;
    preferences: unknown;
  };
}

function isEmptyCollection(value: unknown): boolean {
  return !Array.isArray(value) || value.length === 0;
}

export function hydrateModuleSetupCollectionsFromLegacyObjects(
  collections: Record<string, unknown[]>,
  objects: Record<string, unknown> | undefined,
  config: LegacySetupHydrateConfig,
): Record<string, unknown[]> {
  if (!Array.isArray(collections.users) || !objects) return collections;

  const next: Record<string, unknown[]> = { ...collections };
  const {
    settingsObjectKey,
    columnPreferencesObjectKey,
    fieldConfigCollection,
    modulePrefsCollection,
    columnPrefsCollection,
    splitSettingsBlob,
  } = config;

  if (
    isEmptyCollection(next[fieldConfigCollection]) ||
    isEmptyCollection(next[modulePrefsCollection])
  ) {
    const legacySettings = objects[settingsObjectKey];
    if (legacySettings && typeof legacySettings === "object" && !Array.isArray(legacySettings)) {
      const { fieldConfig, preferences } = splitSettingsBlob(
        legacySettings as Record<string, unknown>,
      );
      if (isEmptyCollection(next[fieldConfigCollection])) {
        next[fieldConfigCollection] = [{ config: fieldConfig }];
      }
      if (isEmptyCollection(next[modulePrefsCollection])) {
        next[modulePrefsCollection] = [{ preferences }];
      }
    }
  }

  if (isEmptyCollection(next[columnPrefsCollection])) {
    const legacyColumn = objects[columnPreferencesObjectKey];
    if (legacyColumn && typeof legacyColumn === "object" && !Array.isArray(legacyColumn)) {
      const rows: Array<Record<string, unknown>> = [];
      for (const [userId, preferences] of Object.entries(legacyColumn as Record<string, unknown>)) {
        if (!userId.trim() || !Array.isArray(preferences)) continue;
        rows.push({ userId, preferences });
      }
      if (rows.length > 0) {
        next[columnPrefsCollection] = rows;
      }
    }
  }

  return next;
}
