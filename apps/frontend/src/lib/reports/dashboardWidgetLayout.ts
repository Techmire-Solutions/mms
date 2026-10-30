import type { CustomWidget } from "./pinnedWidgetTypes";

/** Chart / preference widgets that add depth but are not the first action surface. */
const SECONDARY_DASHBOARD_WIDGET_TYPES = new Set<string>([
  "enrollment-trends",
  "revenue-expenses",
  "attendance-rate",
  "hasanat-distribution",
  "progress",
  "switch",
]);

export function isSecondaryDashboardWidget(widget: Pick<CustomWidget, "widgetType">): boolean {
  return widget.widgetType ? SECONDARY_DASHBOARD_WIDGET_TYPES.has(widget.widgetType) : false;
}

export function splitDashboardWidgets(widgets: readonly CustomWidget[]): {
  primary: CustomWidget[];
  secondary: CustomWidget[];
} {
  const primary: CustomWidget[] = [];
  const secondary: CustomWidget[] = [];
  for (const widget of widgets) {
    (isSecondaryDashboardWidget(widget) ? secondary : primary).push(widget);
  }
  return { primary, secondary };
}
