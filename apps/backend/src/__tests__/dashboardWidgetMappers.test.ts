import { describe, expect, it } from "vitest";
import type { DashboardWidgetDto } from "@mms/shared";
import { toDto, toRestoredDto, toRow } from "../db/repositories/dashboardWidgetMappers.js";

const fullDto: DashboardWidgetDto = {
  id: "custom-1",
  title: "Enrollment trend",
  category: "students",
  collection: "students",
  operation: "count",
  color: "emerald",
  isPinnedToDashboard: true,
  widgetType: "chart",
  role: "admin",
  icon: "users",
  sortOrder: 3,
  titleKey: "dashboard.enrollment",
  chartType: "area",
  xAxisField: "createdAt",
  thresholdEnabled: true,
  thresholdCondition: "lt",
  thresholdValue: 80,
};

describe("dashboard widget mappers", () => {
  it("round-trips a DTO through the row shape", () => {
    expect(toDto(toRow("demo", fullDto, 0))).toEqual(fullDto);
  });

  it("falls back to the batch position when the DTO carries no sortOrder", () => {
    const { sortOrder: _sortOrder, ...withoutSort } = fullDto;
    const row = toRow("demo", withoutSort as DashboardWidgetDto, 7);
    expect(row.sortOrder).toBe(7);
  });

  it("repairs a title-cased raw restore row and unwraps its nested config", () => {
    const dto = toRestoredDto(
      {
        id: "custom-1",
        workspaceSubdomain: "demo",
        widgetType: "Kpi",
        category: "students",
        collection: "Students",
        isPinnedToDashboard: true,
        title: "Active Students",
        color: "emerald",
        operation: "Count",
        sortOrder: 2,
        config: { chartType: "Bar", thresholdCondition: "Lt" },
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      0,
    );

    expect(dto).toMatchObject({
      id: "custom-1",
      widgetType: "kpi",
      collection: "students",
      operation: "count",
      chartType: "bar",
      thresholdCondition: "lt",
    });
    expect(dto).not.toHaveProperty("config");
    expect(dto).not.toHaveProperty("workspaceSubdomain");
  });

  it("keeps unknown custom keys so a custom widget survives a restore", () => {
    const dto = toRestoredDto({ id: "w1", customSwitchRule: "follow-up" }, 0);
    expect(dto?.customSwitchRule).toBe("follow-up");
  });

  it("derives a stable id when the restored record has none", () => {
    expect(toRestoredDto({ title: "Orphan widget" }, 4)?.id).toBe("restore-4");
  });

  it("skips corrupt null/scalar entries instead of aborting the restore", () => {
    for (const corrupt of [null, "widget", 42, ["w1"]]) {
      expect(toRestoredDto(corrupt as unknown as Record<string, unknown>, 0)).toBeNull();
    }
  });
});
