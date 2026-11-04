import { afterEach, describe, expect, it } from "vitest";
import { buildDashboardMetricCard } from "./buildDashboardMetricCard";
import type { DashboardMetricTrends } from "./dashboardMetricTrends";
import type { DashboardCollectionData } from "./useDashboardData";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type {
  AttendanceCommandMetricsSnapshot,
  FinanceCommandMetricsSnapshot,
  SessionsCommandMetricsSnapshot,
  StudentsCommandMetricsSnapshot,
} from "@mms/shared";
import { queryClientInstance } from "@/lib/queryClient";
import { STUDENTS_WIDGET_AGGREGATES_QUERY_KEY } from "@/tenant/hooks/collections/students";

describe("buildDashboardMetricCard", () => {
  afterEach(() => {
    queryClientInstance.removeQueries({ queryKey: STUDENTS_WIDGET_AGGREGATES_QUERY_KEY });
  });

  const mockData: DashboardCollectionData = {
    studentsTotal: 120,
    facultyTotal: 15,
    contactsTotal: 45,
    sessionsTotal: 24,
    studentMetricsInactive: 5,
    studentMetricsActive: 115,
    studentMetricsNew: 8,
    facultyMetricsNew: 1,
    contactMetricsNew: 3,
    // A card is only "available" when its source snapshot exists — the resolver
    // never fabricates a zero from a missing snapshot.
    studentMetrics: {
      total: 120,
      active: 115,
      inactive: 5,
      suspended: 0,
      newThisPeriod: 8,
    } as StudentsCommandMetricsSnapshot,
    financeMetrics: {
      totalInvoices: 17,
      outstanding: 1800,
      overdue: 2,
      paid: 9,
      partial: 1,
      totalPayments: 10,
      collectedTotal: 3200,
      outstandingBalance: 1800,
      discountTotal: 0,
      collectedThisMonth: 900,
      collectedPrevMonth: 800,
      outstandingThisMonth: 1800,
      outstandingPrevMonth: 2000,
    } as FinanceCommandMetricsSnapshot,
    sessionsMetrics: {
      active: 4,
      totalClasses: 8,
      total: 24,
      sessionsThisWeek: 10,
      sessionsLastWeek: 8,
      upcoming: 2,
      completed: 18,
      cancelled: 0,
      totalEnrolled: 100,
      totalCapacity: 120,
    } as SessionsCommandMetricsSnapshot,
    attendanceMetrics: {
      total: 120,
      selectedDatePresentRate: 95,
      priorDatePresentRate: 90,
      overallPresentRate: 92,
      selectedDatePresent: 110,
      selectedDateAbsent: 5,
      selectedDateLate: 3,
      selectedDateExcused: 2,
      periodTotal: 120,
    } as AttendanceCommandMetricsSnapshot,
  };

  const mockTrends: DashboardMetricTrends = {
    studentTrend: 7,
    facultyTrend: 7,
    contactTrend: 7,
    attendanceTrend: 5,
    feesTrend: 12,
    outstandingTrend: -3,
    hasanatTrend: 15,
    sessionsTrend: 25,
  };

  const mockT = ((key: string) => key) as unknown as TranslationFunction;

  it("builds student metric card with resolved title and trends", () => {
    const widget: CustomWidget = {
      id: "def-card-admin-students",
      widgetType: "card",
      role: "admin",
      collection: "students",
      isPinnedToDashboard: true,
      title: "Total Students",
      category: "students",
      operation: "count",
      color: "emerald",
    };

    const card = buildDashboardMetricCard({
      widget,
      data: mockData,
      trends: mockTrends,
      t: mockT,
    });

    expect(card.id).toBe("def-card-admin-students");
    expect(card.value).toBe("120");
    expect(card.trend).toBe(7);
  });

  it("does not let a late aggregate overwrite a seeded summary card", () => {
    queryClientInstance.setQueryData(
      [...STUDENTS_WIDGET_AGGREGATES_QUERY_KEY, "stale-saved-filter"],
      {
        "def-card-admin-students": {
          value: 0,
          totalCount: 120,
          chartData: [],
        },
      },
    );

    const card = buildDashboardMetricCard({
      widget: {
        id: "def-card-admin-students",
        widgetType: "card",
        role: "admin",
        collection: "students",
        isPinnedToDashboard: false,
        title: "Total Students",
        category: "students",
        operation: "count",
        color: "emerald",
      },
      data: mockData,
      trends: mockTrends,
      t: mockT,
    });

    expect(card.value).toBe("120");
  });

  it("maps attendance trend metric correctly via TREND_METRIC_KEY_MAP", () => {
    const widget: CustomWidget = {
      id: "def-card-admin-attendance",
      widgetType: "card",
      role: "admin",
      collection: "attendance_records",
      isPinnedToDashboard: true,
      operation: "percentage",
      title: "Attendance Rate",
      category: "students",
      color: "blue",
    };

    const card = buildDashboardMetricCard({
      widget,
      data: mockData,
      trends: mockTrends,
      t: mockT,
    });

    expect(card.value).toBe("92%");
    expect(card.trend).toBe(5);
  });

  it("handles fallback widget trend when trendMetric is not mapped directly", () => {
    const widget: CustomWidget = {
      id: "custom-unmapped-widget",
      widgetType: "card",
      role: "admin",
      collection: "finance_invoices",
      isPinnedToDashboard: true,
      trend: 42,
      title: "Custom Invoices",
      category: "finance",
      operation: "count",
      color: "blue",
    };

    const card = buildDashboardMetricCard({
      widget,
      data: mockData,
      trends: mockTrends,
      t: mockT,
    });

    expect(card.trend).toBe(42);
  });

  it("marks a card unavailable when its metric snapshot is missing", () => {
    const card = buildDashboardMetricCard({
      widget: {
        id: "def-card-admin-students",
        widgetType: "card",
        role: "admin",
        collection: "students",
        isPinnedToDashboard: true,
        title: "Total Students",
        category: "students",
        operation: "count",
        color: "emerald",
        trend: 42,
      },
      data: { ...mockData, studentMetrics: undefined },
      trends: mockTrends,
      t: mockT,
    });

    expect(card.unavailable).toBe(true);
    expect(card.value).toBe("");
    // No trend chip on a card whose value we could not establish.
    expect(card.trend).toBe(0);
  });
});
