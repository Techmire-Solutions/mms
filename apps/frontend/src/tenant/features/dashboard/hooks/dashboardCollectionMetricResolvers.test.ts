import { describe, expect, it } from "vitest";
import { formatMoney, formatNumber, formatPercent } from "@mms/shared";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import type { DashboardData } from "./useDashboardData";
import { resolveServerMetricValue } from "./dashboardCollectionMetricResolvers";

function widget(overrides: Partial<CustomWidget>): CustomWidget {
  return {
    id: "w-1",
    title: "Widget",
    category: "students",
    collection: "students",
    operation: "count",
    color: "emerald",
    isPinnedToDashboard: false,
    ...overrides,
  } as CustomWidget;
}

const emptyData = {} as DashboardData;

describe("resolveServerMetricValue", () => {
  it("returns null when the source snapshot is absent instead of an authoritative zero", () => {
    const collections: Array<CustomWidget["collection"]> = [
      "contacts",
      "students",
      "faculty",
      "sessions",
      "attendance_records",
      "finance_invoices",
      "hasanat_distributions",
      "questions",
    ];
    for (const collection of collections) {
      expect(resolveServerMetricValue(widget({ collection }), emptyData), collection).toBeNull();
    }
  });

  it("returns null for a collection with no resolver", () => {
    expect(resolveServerMetricValue(widget({ collection: "enrollments" }), emptyData)).toBeNull();
  });

  it("formats a present count snapshot", () => {
    const data = {
      contactMetrics: { total: 5 },
      contactsTotal: 5,
    } as unknown as DashboardData;

    expect(resolveServerMetricValue(widget({ collection: "contacts" }), data)).toEqual({
      value: formatNumber(5),
    });
  });

  it("uses the active-student count for a filtered student card", () => {
    const data = {
      studentMetrics: { total: 10, active: 7 },
      studentsTotal: 10,
      studentMetricsActive: 7,
    } as unknown as DashboardData;

    expect(
      resolveServerMetricValue(widget({ collection: "students", filterValue: "active" }), data),
    ).toEqual({ value: formatNumber(7) });
  });

  it("formats an attendance percentage snapshot", () => {
    const data = {
      attendanceMetrics: { overallPresentRate: 90, total: 10 },
    } as unknown as DashboardData;

    expect(
      resolveServerMetricValue(
        widget({ collection: "attendance_records", operation: "percentage" }),
        data,
      ),
    ).toEqual({ value: formatPercent(90) });
  });

  it("requires the accounting snapshot for revenue cards, not just finance", () => {
    const financeOnly = {
      financeMetrics: { collectedTotal: 100 },
    } as unknown as DashboardData;
    const revenueWidget = widget({
      collection: "finance_invoices",
      id: "def-card-accountant-revenue",
    });

    expect(resolveServerMetricValue(revenueWidget, financeOnly)).toBeNull();

    const withAccounting = {
      financeMetrics: { collectedTotal: 100 },
      accountingMetrics: { revenue: 1000 },
    } as unknown as DashboardData;
    const resolved = resolveServerMetricValue(revenueWidget, withAccounting);
    expect(resolved?.value).toBe(formatMoney(1000, undefined, { useSymbol: true }));
  });
});
