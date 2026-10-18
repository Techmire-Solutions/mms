import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAttendanceAnalyticsModel } from "../hooks/useAttendanceAnalyticsModel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useAttendanceConfig: () => ({
    statuses: [{ id: "present", label: "Present" }],
  }),
}));

vi.mock("@/lib/contexts/BrandingPaletteContext", () => ({
  useBrandPalette: () => ({
    primary: "#1e40af",
    secondary: "#64748b",
    charts: ["#0284c7", "#0d9488", "#10b981", "#f59e0b"],
  }),
}));

vi.mock("@/tenant/hooks/collections/attendance", () => ({
  useAttendanceReportAggregates: () => ({
    data: {
      overview: {
        overallRate: 80,
        totalRecords: 5,
        lowAttendanceCount: 1,
        classRates: [
          {
            classId: "cls-1",
            className: "Class 1",
            sessionName: "2026",
            presentCount: 4,
            total: 5,
            rate: 80,
          },
        ],
        monthlyTrend: [{ monthKey: "2026-08", presentCount: 4, total: 5, rate: 80 }],
        studentRates: [
          {
            studentId: "student-1",
            name: "Ali Hassan",
            presentCount: 1,
            total: 2,
            rate: 50,
          },
        ],
        topPerformers: [
          {
            studentId: "student-2",
            name: "Zayd Ahmed",
            presentCount: 3,
            total: 3,
            rate: 100,
          },
        ],
        statusCounts: [
          { status: "present", count: 3 },
          { status: "late", count: 1 },
          { status: "absent", count: 1 },
        ],
      },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("useAttendanceAnalyticsModel Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("calculates overall rate and pie data", async () => {
    let hookResult!: ReturnType<typeof useAttendanceAnalyticsModel>;

    function TestComponent() {
      hookResult = useAttendanceAnalyticsModel({ classId: "cls-1" });
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();
    expect(hookResult.overallRate).toBe(80);
    expect(hookResult.monthlyTrend).toEqual([{ month: "2026-08", rate: 80 }]);
    expect(hookResult.studentRates).toEqual([{ id: "student-1", name: "Ali H.", rate: 50 }]);
    expect(hookResult.topStudents).toEqual([{ id: "student-2", name: "Zayd A.", rate: 100 }]);
    expect(Array.isArray(hookResult.pieData)).toBe(true);
    expect(hookResult.colors.length).toBe(4);
  });
});
