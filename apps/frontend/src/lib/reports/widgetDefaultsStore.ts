import type { CustomWidget } from "./pinnedWidgetTypes";
import { DASHBOARD_WIDGETS_KEY, normalizeDashboardWidgets } from "@mms/shared";
import { getObject, saveObject } from "@/lib/db";
import { getDefaultCustomWidgets, withDefaultI18nKeys } from "./widgetDefaultSeeds.js";
import { reportClientError } from "@/lib/clientErrorReporting";

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

/**
 * Loads, merges, and initializes the custom widgets database in local storage.
 * Synchronizes new defaults dynamically. Used only for the one-time local→server
 * seed migration in `useDashboardConfig`; server-authoritative Query is the primary path.
 */
export function getOrInitializeCustomWidgets(): CustomWidget[] {
  try {
    const saved = getObject<CustomWidget[] | null>(DASHBOARD_WIDGETS_KEY, null);
    const defaults = buildDefaultCustomWidgets();
    if (!saved) {
      saveObject(DASHBOARD_WIDGETS_KEY, defaults);
      return defaults;
    }
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
    if (hasChanges) {
      saveObject(DASHBOARD_WIDGETS_KEY, merged);
    }
    return merged;
  } catch (error) {
    reportClientError(error, { context: "reports.loadCustomWidgets" });
    return [];
  }
}
