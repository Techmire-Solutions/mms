import { describe, expect, it } from "vitest";
import {
  areDashboardWidgetsDuplicate,
  findDuplicateDashboardWidget,
  type DashboardWidgetComparisonTarget,
} from "./dashboardWidgetDuplicates.js";

describe("dashboardWidgetDuplicates", () => {
  const baseKpi: DashboardWidgetComparisonTarget = {
    id: "widget-1",
    category: "contacts",
    collection: "contacts",
    widgetType: "kpi",
    operation: "count",
    targetField: "",
    filterField: "",
    filterValue: "",
  };

  it("identifies a duplicate KPI widget with different id and title", () => {
    const candidate: DashboardWidgetComparisonTarget = {
      id: "widget-2",
      category: "contacts",
      collection: "contacts",
      widgetType: "kpi",
      operation: "count",
      targetField: "",
      filterField: "",
      filterValue: "",
    };

    expect(areDashboardWidgetsDuplicate(candidate, baseKpi)).toBe(true);
    expect(findDuplicateDashboardWidget(candidate, [baseKpi])).toEqual(baseKpi);
  });

  it("does not flag updating the same widget (matching id)", () => {
    const updating: DashboardWidgetComparisonTarget = {
      ...baseKpi,
      id: "widget-1",
    };

    expect(areDashboardWidgetsDuplicate(updating, baseKpi)).toBe(false);
    expect(findDuplicateDashboardWidget(updating, [baseKpi])).toBe(null);
  });

  it("does not flag widgets with different operations", () => {
    const candidate: DashboardWidgetComparisonTarget = {
      ...baseKpi,
      id: "widget-2",
      operation: "sum",
      targetField: "age",
    };

    expect(areDashboardWidgetsDuplicate(candidate, baseKpi)).toBe(false);
    expect(findDuplicateDashboardWidget(candidate, [baseKpi])).toBe(null);
  });

  it("does not flag widgets with different collections", () => {
    const candidate: DashboardWidgetComparisonTarget = {
      ...baseKpi,
      id: "widget-2",
      collection: "students",
    };

    expect(areDashboardWidgetsDuplicate(candidate, baseKpi)).toBe(false);
  });

  it("does not flag widgets with different filter values", () => {
    const filtered1: DashboardWidgetComparisonTarget = {
      ...baseKpi,
      filterField: "gender",
      filterOperator: "equals",
      filterValue: "male",
    };
    const filtered2: DashboardWidgetComparisonTarget = {
      ...baseKpi,
      id: "widget-2",
      filterField: "gender",
      filterOperator: "equals",
      filterValue: "female",
    };

    expect(areDashboardWidgetsDuplicate(filtered1, filtered2)).toBe(false);
  });

  it("flags filtered widgets when filter field and value match case-insensitively", () => {
    const filtered1: DashboardWidgetComparisonTarget = {
      ...baseKpi,
      filterField: "gender",
      filterOperator: "equals",
      filterValue: "Male",
    };
    const filtered2: DashboardWidgetComparisonTarget = {
      ...baseKpi,
      id: "widget-2",
      filterField: "gender",
      filterOperator: "equals",
      filterValue: "male",
    };

    expect(areDashboardWidgetsDuplicate(filtered1, filtered2)).toBe(true);
  });

  it("handles normalized category comparison (e.g. finance vs financial)", () => {
    const fin1: DashboardWidgetComparisonTarget = {
      ...baseKpi,
      category: "finance",
      collection: "invoices",
    };
    const fin2: DashboardWidgetComparisonTarget = {
      ...baseKpi,
      id: "widget-2",
      category: "financial",
      collection: "invoices",
    };

    expect(areDashboardWidgetsDuplicate(fin1, fin2)).toBe(true);
  });

  it("correctly identifies duplicate switch widgets", () => {
    const switch1: DashboardWidgetComparisonTarget = {
      id: "s-1",
      category: "students",
      collection: "students",
      widgetType: "switch",
      operation: "count",
      switchActionType: "app_setting",
      switchStateKey: "attendance_lock",
    };
    const switch2: DashboardWidgetComparisonTarget = {
      id: "s-2",
      category: "students",
      collection: "students",
      widgetType: "switch",
      operation: "count",
      switchActionType: "app_setting",
      switchStateKey: "attendance_lock",
    };

    expect(areDashboardWidgetsDuplicate(switch1, switch2)).toBe(true);
  });
});
