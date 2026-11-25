import { describe, expect, it } from "vitest";
import { isSecondaryDashboardWidget, splitDashboardWidgets } from "./dashboardWidgetLayout";
import type { CustomWidget } from "./pinnedWidgetTypes";

const widget = (id: string, widgetType: CustomWidget["widgetType"]): CustomWidget =>
  ({ id, widgetType }) as CustomWidget;

describe("dashboardWidgetLayout", () => {
  it("separates charts and switches from action lists", () => {
    const { primary, secondary } = splitDashboardWidgets([
      widget("overdue", "overdue-obligations"),
      widget("chart", "enrollment-trends"),
      widget("toggle", "switch"),
      widget("sessions", "sessions-list"),
    ]);
    expect(primary.map((item) => item.id)).toEqual(["overdue", "sessions"]);
    expect(secondary.map((item) => item.id)).toEqual(["chart", "toggle"]);
  });

  it("treats unknown/custom widget types as primary", () => {
    expect(isSecondaryDashboardWidget({ widgetType: "custom-table" as never })).toBe(false);
  });
});
