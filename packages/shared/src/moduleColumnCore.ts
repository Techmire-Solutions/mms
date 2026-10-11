/**
 * @file moduleColumnCore.ts
 * @description Core primitives and algorithms for module Work column preferences, sizing, and overlay.
 */
import {
  buildStudentWorkColumnRegistry,
  type StudentWorkColumnLabels,
} from "./studentColumnRegistrySync.js";
import {
  buildFacultyWorkColumnRegistry,
  type FacultyWorkColumnLabels,
} from "./facultyColumnRegistrySync.js";

export {
  buildStudentWorkColumnRegistry,
  type StudentWorkColumnLabels,
  buildFacultyWorkColumnRegistry,
  type FacultyWorkColumnLabels,
};

/** Per-user Work directory column layout (globle1 §3.4). */
export interface ModuleColumnPreference {
  key: string;
  enabled: boolean;
  order: number;
  /** Optional pixel width when the user has resized the column. */
  width?: number;
}

export type ModuleColumnPref = ModuleColumnPreference;

export interface ModuleColumnRegistryEntry extends ModuleColumnPreference {
  label: string;
  fixed?: boolean;
}

export type UserModuleColumnPreferencesMap = Record<string, ModuleColumnPreference[]>;

export const MODULE_COLUMN_WIDTH_MIN = 80;
export const MODULE_COLUMN_WIDTH_MAX = 640;

/** Custom-field key when a Work column key is prefixed with `custom:`, else `null`. */
export function customFieldKeyFromColumnKey(columnKey: string): string | null {
  if (!columnKey.startsWith("custom:")) return null;
  return columnKey.slice("custom:".length);
}

/** Clamp a user-resized column width to the supported range. */
export function clampModuleColumnWidth(width: number): number {
  if (!Number.isFinite(width)) return MODULE_COLUMN_WIDTH_MIN;
  return Math.min(MODULE_COLUMN_WIDTH_MAX, Math.max(MODULE_COLUMN_WIDTH_MIN, Math.round(width)));
}

export function applyModuleColumnOverlay(
  registry: ModuleColumnRegistryEntry[],
  preferences: ModuleColumnPreference[] | null,
): ModuleColumnRegistryEntry[] {
  if (!preferences?.length) return registry;
  const preferenceByKey = new Map(preferences.map((preference) => [preference.key, preference]));
  return registry.map((column) => {
    const preference = preferenceByKey.get(column.key);
    if (!preference) return column;
    return {
      ...column,
      enabled: column.fixed ? column.enabled : preference.enabled,
      order: preference.order,
      width: preference.width ?? column.width,
    };
  });
}

/**
 * Merge server column prefs with device-local prefs so resized widths are not wiped
 * when the server payload omits `width` (stale GET / older saves).
 * Server wins for enabled/order; width prefers this device's local value, then server.
 */
export function mergeModuleColumnPreferences(
  serverPreferences: ModuleColumnPreference[] | null | undefined,
  localPreferences: ModuleColumnPreference[] | null | undefined,
): ModuleColumnPreference[] | null {
  if (!serverPreferences?.length && !localPreferences?.length) return null;
  if (!serverPreferences?.length) return localPreferences ?? null;
  if (!localPreferences?.length) return serverPreferences;

  const localByKey = new Map(localPreferences.map((preference) => [preference.key, preference]));
  const mergedKeys = new Set<string>();
  const merged: ModuleColumnPreference[] = serverPreferences.map((serverPreference) => {
    mergedKeys.add(serverPreference.key);
    const localPreference = localByKey.get(serverPreference.key);
    const next: ModuleColumnPreference = {
      key: serverPreference.key,
      enabled: serverPreference.enabled,
      order: serverPreference.order,
    };
    const width = localPreference?.width ?? serverPreference.width;
    if (typeof width === "number") {
      next.width = clampModuleColumnWidth(width);
    }
    return next;
  });

  if (localPreferences) {
    for (const localPreference of localPreferences) {
      if (mergedKeys.has(localPreference.key)) continue;
      merged.push({
        key: localPreference.key,
        enabled: localPreference.enabled,
        order: localPreference.order,
        width:
          typeof localPreference.width === "number"
            ? clampModuleColumnWidth(localPreference.width)
            : undefined,
      });
    }
  }

  return merged;
}

export function isModuleColumnVisible(registry: ModuleColumnRegistryEntry[], key: string): boolean {
  const column = registry.find((registryColumn) => registryColumn.key === key);
  return column?.enabled ?? false;
}

export function getModuleColumnWidth(
  registry: ModuleColumnRegistryEntry[],
  key: string,
): number | undefined {
  const column = registry.find((registryColumn) => registryColumn.key === key);
  return column?.width;
}

/**
 * Visible Work columns in registry order.
 * Pass `excludeFace` to omit card face chrome columns from metadata grids.
 */
export function getVisibleWorkColumns(
  registry: ModuleColumnRegistryEntry[],
  isColumnVisible: (key: string) => boolean,
  options?: { excludeFace?: ReadonlySet<string> },
): ModuleColumnRegistryEntry[] {
  return [...registry]
    .filter((col) => {
      if (!isColumnVisible(col.key)) return false;
      if (options?.excludeFace?.has(col.key)) return false;
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

/** Helper to build a standard module column registry array from an ordered list of keys and labels. */
export function createColumnRegistry<T extends object>(
  keys: (keyof T & string)[],
  labels: T,
  fixedFirst = true,
): ModuleColumnRegistryEntry[] {
  return keys.map((key, index) => ({
    key,
    label: String(labels[key as keyof T] ?? ""),
    enabled: true,
    order: index,
    ...(index === 0 && fixedFirst ? { fixed: true } : {}),
  }));
}
