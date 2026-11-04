import type { CustomWidget } from "./pinnedWidgetTypes";
import { DASHBOARD_WIDGETS_KEY, normalizeDashboardWidgets } from "@mms/shared";
import { getObject, readObjectLocal, saveObject } from "@/lib/db";
import { safeSetItem, scopedStorageKey } from "@/lib/dbStorageCore";
import { getDefaultCustomWidgets, withDefaultI18nKeys } from "./widgetDefaultSeeds";
import { reportClientError, reportClientWarn } from "@/lib/clientErrorReporting";

const DASHBOARD_WIDGETS_SEEDED_KEY = "dashboard_widgets_seeded_marker";

const SEEDED_WIDGET_BEHAVIOR_KEYS = [
  "category",
  "collection",
  "widgetType",
  "operation",
  "role",
  "targetField",
  "filterField",
  "filterOperator",
  "filterValue",
  "switchActionType",
  "switchStateKey",
  "switchCollection",
  "switchField",
  "xAxisField",
] as const satisfies readonly (keyof CustomWidget)[];

function restoreSeededWidgetBehavior(
  widget: CustomWidget,
  defaultWidget: CustomWidget,
): CustomWidget {
  const restored: Partial<CustomWidget> = { ...widget };
  for (const key of SEEDED_WIDGET_BEHAVIOR_KEYS) {
    const value = defaultWidget[key];
    if (value === undefined) {
      delete restored[key];
    } else {
      restored[key] = value as never;
    }
  }
  return restored as CustomWidget;
}

/** Pure union of all seeded default widgets across categories (no localStorage I/O). */
export function buildDefaultCustomWidgets(): CustomWidget[] {
  return [
    ...getDefaultCustomWidgets("contacts"),
    ...getDefaultCustomWidgets("students"),
    ...getDefaultCustomWidgets("financial"),
    ...getDefaultCustomWidgets("hasanat"),
    ...getDefaultCustomWidgets("sessions"),
  ].map(withDefaultI18nKeys);
}

/** Pure merge of a stored legacy widget list against the current defaults. */
function buildMergedCustomWidgets(saved: CustomWidget[] | null): {
  widgets: CustomWidget[];
  hasChanges: boolean;
} {
  const defaults = buildDefaultCustomWidgets();
  if (!saved) return { widgets: defaults, hasChanges: true };

  const defaultsById = new Map(defaults.map((widget) => [widget.id, widget]));
  const normalized = normalizeDashboardWidgets(saved) as CustomWidget[];
  const parsed = normalized.map((widget) => {
    const defaultWidget = defaultsById.get(widget.id);
    const repaired = defaultWidget ? restoreSeededWidgetBehavior(widget, defaultWidget) : widget;
    return withDefaultI18nKeys(repaired);
  });
  const existingIds = new Set(parsed.map((widget) => widget.id));
  const merged = [...parsed];
  let hasChanges = JSON.stringify(saved) !== JSON.stringify(parsed);
  for (const defaultWidget of defaults) {
    if (!existingIds.has(defaultWidget.id)) {
      merged.push(defaultWidget);
      hasChanges = true;
    } else {
      const widgetIndex = merged.findIndex((widget) => widget.id === defaultWidget.id);
      if (widgetIndex >= 0) {
        if (merged[widgetIndex].widgetType !== defaultWidget.widgetType) {
          merged[widgetIndex] = { ...merged[widgetIndex], widgetType: defaultWidget.widgetType };
          hasChanges = true;
        }
        if (defaultWidget.titleKey && !merged[widgetIndex].titleKey) {
          merged[widgetIndex] = { ...merged[widgetIndex], titleKey: defaultWidget.titleKey };
          hasChanges = true;
        }
        if (defaultWidget.switchLabelOnKey && !merged[widgetIndex].switchLabelOnKey) {
          merged[widgetIndex] = {
            ...merged[widgetIndex],
            switchLabelOnKey: defaultWidget.switchLabelOnKey,
            switchLabelOffKey: defaultWidget.switchLabelOffKey,
          };
          hasChanges = true;
        }
        if (defaultWidget.fixedSubTextKey && !merged[widgetIndex].fixedSubTextKey) {
          merged[widgetIndex] = {
            ...merged[widgetIndex],
            fixedSubTextKey: defaultWidget.fixedSubTextKey,
          };
          hasChanges = true;
        }
        if (defaultWidget.widgetType === "card" && merged[widgetIndex].isPinnedToDashboard) {
          merged[widgetIndex] = { ...merged[widgetIndex], isPinnedToDashboard: false };
          hasChanges = true;
        }
      }
    }
  }
  return { widgets: merged, hasChanges };
}

/**
 * Loads, merges, and initializes the custom widgets database in local storage.
 * Synchronizes new defaults dynamically. Used only for the one-time local→server
 * seed migration in `useDashboardConfig`; server-authoritative Query is the primary path.
 */
export function getOrInitializeCustomWidgets(): CustomWidget[] {
  try {
    const saved = getObject<CustomWidget[] | null>(DASHBOARD_WIDGETS_KEY, null);
    const { widgets, hasChanges } = buildMergedCustomWidgets(saved);
    if (!saved || hasChanges) {
      saveObject(DASHBOARD_WIDGETS_KEY, widgets);
    }
    return widgets;
  } catch (error) {
    reportClientError(error, { context: "reports.loadCustomWidgets" });
    return [];
  }
}

/**
 * Read-only view of the one-time seed set (legacy browser blob merged over the
 * current defaults). Never writes back and never syncs: the dashboard uses it
 * only as a first-paint placeholder and as the migration payload, so an empty
 * server dashboard cannot be repopulated by a stale local blob.
 */
export function peekSeedWidgets(): CustomWidget[] {
  try {
    const saved = readObjectLocal<CustomWidget[] | null>(DASHBOARD_WIDGETS_KEY);
    return buildMergedCustomWidgets(Array.isArray(saved) ? saved : null).widgets;
  } catch (error) {
    reportClientWarn(error, { context: "reports.peekSeedWidgets" });
    return buildDefaultCustomWidgets();
  }
}

/** True once this workspace finished the one-time local→server widget migration. */
export function hasSeededDashboardWidgets(): boolean {
  try {
    return localStorage.getItem(scopedStorageKey(DASHBOARD_WIDGETS_SEEDED_KEY)) === "1";
  } catch {
    return false;
  }
}

/**
 * Marks the migration complete. Without this, deleting every widget would be
 * undone on the next page load by the seed effect (the server list is empty
 * both before the migration and after a deliberate delete).
 */
export function markDashboardWidgetsSeeded(): void {
  try {
    safeSetItem(scopedStorageKey(DASHBOARD_WIDGETS_SEEDED_KEY), "1");
  } catch (error) {
    reportClientWarn(error, { context: "reports.markDashboardWidgetsSeeded" });
  }
}

/** Drops the legacy browser-only widget blob once the server is authoritative. */
export function clearLegacyDashboardWidgets(): void {
  try {
    localStorage.removeItem(scopedStorageKey(DASHBOARD_WIDGETS_KEY));
  } catch (error) {
    reportClientWarn(error, { context: "reports.clearLegacyDashboardWidgets" });
  }
}
