import { describe, expect, it } from "vitest";
import type { ContactsReportAnalyticsSnapshot } from "@mms/contracts";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import { computeDerivedKpiMetrics } from "./kpiSummaryDerivedMetrics";

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as TranslationFunction;

const makeContacts = (
  overrides: Partial<ContactsReportAnalyticsSnapshot> = {},
): ContactsReportAnalyticsSnapshot => ({
  total: 0,
  activeCount: 0,
  whatsappCount: 0,
  whatsappRate: 0,
  missingInfoCount: 0,
  newThisPeriod: 0,
  newLast30Days: 0,
  newPrior30Days: 0,
  hasSignupDates: true,
  growthRecentSignups30d: 0,
  growthPriorSignups30d: 0,
  ...overrides,
});

describe("computeDerivedKpiMetrics", () => {
  it("computes contacts analytics, growth velocity, and falls back cleanly without contacts", () => {
    const withContacts = computeDerivedKpiMetrics({
      category: "contacts",
      contactAnalytics: makeContacts({
        total: 120,
        newLast30Days: 15,
        newPrior30Days: 10,
        growthRecentSignups30d: 18,
        growthPriorSignups30d: 12,
      }),
      t,
    });
    expect(withContacts.totalStudentsValue).toBe("120");
    expect(withContacts.totalStudentsTrend).toBe("up");
    expect(withContacts.totalStudentsVelocity).toBe("50%");
    expect(withContacts.growthValue).toBe("+50%");
    expect(withContacts.growthTrend).toBe("up");

    const priorZeroDeclining = computeDerivedKpiMetrics({
      category: "contacts",
      contactAnalytics: makeContacts({
        total: 20,
        newLast30Days: 2,
        newPrior30Days: 5,
        growthRecentSignups30d: 3,
        growthPriorSignups30d: 0,
      }),
      t,
    });
    expect(priorZeroDeclining.totalStudentsTrend).toBe("down");
    expect(priorZeroDeclining.totalStudentsVelocity).toBe("-60%");
    expect(priorZeroDeclining.growthValue).toBe("+300%");

    const negativeGrowth = computeDerivedKpiMetrics({
      category: "contacts",
      contactAnalytics: makeContacts({
        total: 20,
        growthRecentSignups30d: 2,
        growthPriorSignups30d: 4,
      }),
      t,
    });
    expect(negativeGrowth.growthValue).toBe("-50%");
    expect(negativeGrowth.growthTrend).toBe("down");

    const flatGrowth = computeDerivedKpiMetrics({
      category: "contacts",
      contactAnalytics: makeContacts({ total: 10 }),
      t,
    });
    expect(flatGrowth.growthValue).toBe("0%");
    expect(flatGrowth.growthTrend).toBe("flat");

    const noContacts = computeDerivedKpiMetrics({ category: "contacts", t });
    expect(noContacts.totalStudentsValue).toBe("0");
    expect(noContacts.totalStudentsSub).toBe("reports.kpi.sub.noContacts");
  });

  it("handles students and auxiliary module metrics with trend edge cases", () => {
    const full = computeDerivedKpiMetrics({
      category: "students",
      contactAnalytics: makeContacts({
        total: 50,
        newLast30Days: 5,
        newPrior30Days: 5,
        growthRecentSignups30d: 5,
        growthPriorSignups30d: 5,
      }),
      studentMetrics: { total: 80, active: 70, inactive: 5, suspended: 5, newThisPeriod: 4 },
      attendanceMetrics: {
        total: 10,
        overallPresentRate: 92,
        selectedDatePresentRate: 90,
        priorDatePresentRate: 85,
      } as never,
      financeMetrics: {
        totalInvoices: 5,
        collectedTotal: 1500,
        outstandingBalance: 400,
        outstanding: 2,
        collectedThisMonth: 600,
        collectedPrevMonth: 800,
        outstandingThisMonth: 100,
        outstandingPrevMonth: 0,
      } as never,
      hasanatMetrics: {
        totalPointsDistributed: 300,
        distributed: 0,
        pointsThisWeek: 50,
        pointsLastWeek: 50,
      } as never,
      sessionsMetrics: {
        total: 3,
        totalCapacity: 40,
        totalEnrolled: 30,
        totalClasses: 4,
        sessionsThisWeek: 0,
        sessionsLastWeek: 0,
      } as never,
      examinationsMetrics: { total: 4, totalResults: 12, passRate: 88 } as never,
      t,
    });

    expect(full.totalStudentsValue).toBe("80");
    expect(full.totalStudentsTrend).toBe("up");
    expect(full.growthValue).toBe("+0%");
    expect(full.growthTrend).toBe("flat");
    expect(full.capacityUsed).toBe(75);
    expect(full.attendanceTrend).toBe("up");
    expect(full.feesTrend).toBe("down");
    expect(full.outstandingTrend).toBe("up");
    expect(full.hasanatTrend).toBe("flat");
    expect(full.hasAttendanceData).toBe(true);
    expect(full.hasFinanceData).toBe(true);
    expect(full.hasHasanatData).toBe(true);
    expect(full.hasExamData).toBe(true);
    expect(full.hasSessionsData).toBe(true);

    const emptyOther = computeDerivedKpiMetrics({
      category: "sessions",
      auxiliaryStudentMetrics: {
        total: 10,
        active: 9,
        inactive: 1,
        suspended: 0,
        newThisPeriod: 0,
      },
      attendanceMetrics: {
        selectedDatePresentRate: 70,
        priorDatePresentRate: 80,
      } as never,
      t,
    });
    expect(emptyOther.attendanceTrend).toBe("down");
    expect(emptyOther.attendanceRate).toBe(70);
    expect(emptyOther.hasExamData).toBe(false);
    expect(emptyOther.capacityUsed).toBe(0);
  });
});
