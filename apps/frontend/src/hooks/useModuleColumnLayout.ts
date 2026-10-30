import { useCallback, useMemo } from "react";
import {
  applyModuleColumnOverlay,
  clampModuleColumnWidth,
  getModuleColumnWidth,
  isModuleColumnVisible,
  type ModuleColumnPref,
  type ModuleColumnRegistryEntry,
  type AppTranslationKey,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useUiPreference } from "@/lib/useUiStateStore";

export interface UseModuleColumnLayoutOptions {
  moduleId: string;
  tenantRegistry: ModuleColumnRegistryEntry[];
  /** @deprecated No longer used, managed by useUiPreference unified store */
  apiPath?: string;
  /** @deprecated No longer used, managed by useUiPreference unified store */
  serverColumnPrefs?: ModuleColumnPref[] | null;
  /** @deprecated No longer used, managed by useUiPreference unified store */
  columnPrefsLoaded?: boolean;
  /** @deprecated No longer used, managed by useUiPreference unified store */
  saveColumnPrefs?: (prefs: ModuleColumnPref[]) => void;
  /** Optional normalize (e.g. Contacts emergency key migration) applied on load. */
  normalizePreferences?: (prefs: ModuleColumnPref[]) => ModuleColumnPref[];
  translationPrefix?: string;
}

function toStoredPreferences(registry: ModuleColumnRegistryEntry[]): ModuleColumnPref[] {
  return registry.map(({ key, enabled, order, width }) => {
    const preference: ModuleColumnPref = { key, enabled, order };
    if (typeof width === "number") {
      preference.width = clampModuleColumnWidth(width);
    }
    return preference;
  });
}

export function useModuleColumnLayout({
  moduleId,
  tenantRegistry,
  normalizePreferences,
  translationPrefix,
}: UseModuleColumnLayoutOptions) {
  const { t } = useTranslation();

  const prefKey = `${moduleId}.table.columns`;
  const [userOverlayRaw, setUserOverlay] = useUiPreference<ModuleColumnPref[] | null>(
    prefKey,
    null,
  );

  const userOverlay = useMemo(
    () =>
      userOverlayRaw && normalizePreferences
        ? normalizePreferences(userOverlayRaw)
        : userOverlayRaw,
    [userOverlayRaw, normalizePreferences],
  );

  // Stable registry identity keeps DataTable's visible columns (and therefore its
  // memoized row props) stable across unrelated re-renders.
  const columnRegistry = useMemo(
    () => applyModuleColumnOverlay(tenantRegistry, userOverlay),
    [tenantRegistry, userOverlay],
  );

  const isColumnVisible = useCallback(
    (key: string) => isModuleColumnVisible(columnRegistry, key),
    [columnRegistry],
  );

  const getColumnWidth = useCallback(
    (key: string) => getModuleColumnWidth(columnRegistry, key),
    [columnRegistry],
  );

  const updateUserColumnLayout = useCallback(
    (newRegistry: ModuleColumnRegistryEntry[]) => {
      const preferences = toStoredPreferences(newRegistry);
      setUserOverlay(preferences);
    },
    [setUserOverlay],
  );

  const setColumnWidth = (key: string, width: number) => {
    const nextWidth = clampModuleColumnWidth(width);
    const nextRegistry = columnRegistry.map((column) =>
      column.key === key ? { ...column, width: nextWidth } : column,
    );
    updateUserColumnLayout(nextRegistry);
  };

  const customizerLabels = (() => ({
    trigger: translationPrefix
      ? t(`${translationPrefix}.trigger` as AppTranslationKey)
      : t("common.columns.trigger"),
    title: translationPrefix
      ? t(`${translationPrefix}.title` as AppTranslationKey)
      : t("common.columns.title"),
    visibleAndOrder: translationPrefix
      ? t(`${translationPrefix}.visibleAndOrder` as AppTranslationKey)
      : t("common.columns.visibleAndOrder"),
    hidden: translationPrefix
      ? t(`${translationPrefix}.hidden` as AppTranslationKey)
      : t("common.columns.hidden"),
    fixed: translationPrefix
      ? t(`${translationPrefix}.fixed` as AppTranslationKey)
      : t("common.columns.fixed"),
    hideColumn: (label: string) =>
      translationPrefix
        ? t(`${translationPrefix}.hideColumn` as AppTranslationKey, { label })
        : t("common.columns.hideColumn", { label }),
    reset: t("common.columns.reset"),
    searchPlaceholder: t("common.columns.searchPlaceholder"),
    showAll: t("common.columns.showAll"),
    hideAll: t("common.columns.hideAll"),
  }))();

  const resetColumnLayout = useCallback(() => {
    updateUserColumnLayout(tenantRegistry);
  }, [updateUserColumnLayout, tenantRegistry]);

  return {
    columnRegistry,
    isColumnVisible,
    getColumnWidth,
    setColumnWidth,
    updateUserColumnLayout,
    resetColumnLayout,
    customizerLabels,
  };
}
