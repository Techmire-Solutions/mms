import { describe, expect, it } from "vitest";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { buildWidgetSavePayload } from "./widgetBuilderStateHelpers";

const existingWidget: CustomWidget = {
  id: "custom-1",
  title: "Enrollment trend",
  titleKey: "widget.title.enrollmentTrends",
  category: "students",
  collection: "students",
  widgetType: "chart",
  operation: "count",
  color: "emerald",
  isPinnedToDashboard: true,
  sortOrder: 4,
  chartType: "area",
  xAxisField: "createdAt",
  switchLabelOnKey: "reports.widgets.statusOn",
} as CustomWidget;

interface SaveArgs {
  editWidgetConfig: CustomWidget | null;
  builderTitle: string;
}

function save({ editWidgetConfig, builderTitle }: SaveArgs): CustomWidget {
  return buildWidgetSavePayload(
    editWidgetConfig,
    "students",
    "dashboard",
    builderTitle,
    "students",
    "chart",
    "count",
    "",
    "",
    "equals",
    "",
    "emerald",
    false,
    "lt",
    "",
    "red",
    "app_setting",
    "",
    "students",
    "",
    "status",
    "On",
    "Off",
    "GraduationCap",
    "dynamic",
    "",
    0,
    "database",
    "admin",
  );
}

describe("buildWidgetSavePayload", () => {
  it("preserves fields the builder does not own when editing", () => {
    const saved = save({ editWidgetConfig: existingWidget, builderTitle: "Enrollment trend" });

    // A missing sortOrder made every edited widget jump to the top of its group.
    expect(saved.sortOrder).toBe(4);
    expect(saved.chartType).toBe("area");
    expect(saved.xAxisField).toBe("createdAt");
    expect(saved.titleKey).toBe("widget.title.enrollmentTrends");
    expect(saved.switchLabelOnKey).toBe("reports.widgets.statusOn");
    expect(saved.isPinnedToDashboard).toBe(true);
  });

  it("applies the edited fields over the previous widget", () => {
    const saved = save({ editWidgetConfig: existingWidget, builderTitle: "Renamed widget" });

    expect(saved.id).toBe("custom-1");
    expect(saved.title).toBe("Renamed widget");
    expect(saved.color).toBe("emerald");
  });

  it("does not invent a sort order for a brand-new widget", () => {
    const saved = save({ editWidgetConfig: null, builderTitle: "Fresh widget" });

    expect(saved.sortOrder).toBeUndefined();
    expect(saved.id).toMatch(/^widget-/);
    expect(saved.isPinnedToDashboard).toBe(false);
  });
});
