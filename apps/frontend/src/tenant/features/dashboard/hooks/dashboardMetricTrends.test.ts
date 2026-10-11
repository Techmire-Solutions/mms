import { describe, expect, it } from "vitest";
import {
  computeDashboardMetricTrends,
  percentChange,
} from "@/tenant/features/dashboard/hooks/dashboardMetricTrends";
import type { DashboardCollectionData } from "@/tenant/features/dashboard/hooks/useDashboardData";
import type {
  AttendanceCommandMetricsSnapshot,
  FinanceCommandMetricsSnapshot,
  HasanatCommandMetricsSnapshot,
  SessionsCommandMetricsSnapshot,
} from "@mms/shared";

describe("computeDashboardMetricTrends", () => {
  it("computes trend percentages correctly for student, faculty, and contact metrics", () => {
    const mockData: DashboardCollectionData = {
      studentsTotal: 100,
      studentMetricsNew: 10,
      facultyTotal: 20,
      facultyMetricsNew: 2,
      contactsTotal: 50,
      sessionsTotal: 20,
      contactMetricsNew: 5,
      studentMetricsInactive: 5,
      studentMetricsActive: 95,
      attendanceMetrics: {
        total: 100,
        selectedDatePresentRate: 92,
        priorDatePresentRate: 88,
        overallPresentRate: 90,
      } as AttendanceCommandMetricsSnapshot,
      financeMetrics: {
        collectedTotal: 5000,
        outstandingBalance: 1000,
        discountTotal: 200,
        collectedThisMonth: 1200,
        collectedPrevMonth: 1000,
        outstandingThisMonth: 500,
        outstandingPrevMonth: 400,
        totalInvoices: 50,
        paid: 40,
        overdue: 2,
      } as FinanceCommandMetricsSnapshot,
      hasanatMetrics: {
        totalPointsDistributed: 500,
        distributed: 50,
        pointsThisWeek: 150,
        pointsLastWeek: 100,
      } as HasanatCommandMetricsSnapshot,
      sessionsMetrics: {
        active: 5,
        totalClasses: 10,
        total: 20,
        sessionsThisWeek: 12,
        sessionsLastWeek: 10,
      } as SessionsCommandMetricsSnapshot,
    };

    const trends = computeDashboardMetricTrends(mockData);

    expect(trends.studentTrend).toBe(11); // 10 / (100 - 10) = 11.11% -> 11
    expect(trends.facultyTrend).toBe(11); // 2 / (20 - 2) = 11.11% -> 11
    expect(trends.contactTrend).toBe(11); // 5 / (50 - 5) = 11.11% -> 11
    expect(trends.attendanceTrend).toBe(4); // 92 - 88
    expect(trends.feesTrend).toBe(20); // (1200 - 1000) / 1000 = 20%
    expect(trends.outstandingTrend).toBe(25); // (500 - 400) / 400 = 25%
    expect(trends.hasanatTrend).toBe(50); // (150 - 100) / 100 = 50%
    expect(trends.sessionsTrend).toBe(20); // (12 - 10) / 10 = 20%
  });

  it("handles zero or missing metrics safely without division by zero", () => {
    const mockData: DashboardCollectionData = {
      studentsTotal: 0,
      facultyTotal: 0,
      contactsTotal: 0,
      sessionsTotal: 0,
      studentMetricsInactive: 0,
      studentMetricsActive: 0,
      studentMetricsNew: 0,
      facultyMetricsNew: 0,
      contactMetricsNew: 0,
    };

    const trends = computeDashboardMetricTrends(mockData);

    expect(trends.studentTrend).toBe(0);
    expect(trends.facultyTrend).toBe(0);
    expect(trends.contactTrend).toBe(0);
    expect(trends.attendanceTrend).toBe(0);
    expect(trends.feesTrend).toBe(0);
    expect(trends.outstandingTrend).toBe(0);
    expect(trends.hasanatTrend).toBe(0);
    expect(trends.sessionsTrend).toBe(0);
  });

  describe("percentChange", () => {
    it("returns 100 when previous is zero and current is positive", () => {
      expect(percentChange(10, 0)).toBe(100);
    });

    it("returns 0 when both are zero", () => {
      expect(percentChange(0, 0)).toBe(0);
    });

    it("rounds relative delta", () => {
      expect(percentChange(150, 100)).toBe(50);
      expect(percentChange(50, 100)).toBe(-50);
    });
  });
});
