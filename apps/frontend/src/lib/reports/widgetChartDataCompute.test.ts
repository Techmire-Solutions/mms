import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomWidget } from "./pinnedWidgetTypes";
import type { ReportCollectionsSnapshot } from "@/lib/reports/useReportCollections";

const {
  readContactsWidgetAggregate,
  readStudentsWidgetAggregate,
  readFacultyWidgetAggregate,
  readSessionsWidgetAggregate,
  readEnrollmentsWidgetAggregate,
} = vi.hoisted(() => ({
  readContactsWidgetAggregate: vi.fn(),
  readStudentsWidgetAggregate: vi.fn(),
  readFacultyWidgetAggregate: vi.fn(),
  readSessionsWidgetAggregate: vi.fn(),
  readEnrollmentsWidgetAggregate: vi.fn(),
}));

vi.mock("./widgetAggregateReaders.js", () => ({
  readContactsWidgetAggregate,
  readStudentsWidgetAggregate,
  readFacultyWidgetAggregate,
  readSessionsWidgetAggregate,
  readEnrollmentsWidgetAggregate,
}));

import { computeWidgetChartData } from "./widgetChartDataCompute";

function emptyCollections(
  overrides: Partial<ReportCollectionsSnapshot> = {},
): ReportCollectionsSnapshot {
  return {
    students: [],
    faculty: [],
    sessions: [],
    enrollments: [],
    finance_invoices: [],
    attendance_records: [],
    hasanat_distributions: [],
    hasanat_denoms: [],
    contacts: [],
    questions: [],
    tests: [],
    assessment_results: [],
    ...overrides,
  };
}

const baseWidget: CustomWidget = {
  id: "w-1",
  title: "Test",
  category: "reports",
  collection: "attendance_records",
  operation: "count",
  color: "emerald",
  isPinnedToDashboard: false,
};

describe("computeWidgetChartData", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("SQL aggregate cached entities", () => {
    it("returns chartData from faculty aggregate reader for faculty collection", () => {
      const chartPoints = [{ name: "Active", value: 12 }];
      readFacultyWidgetAggregate.mockReturnValue({
        value: 12,
        totalCount: 12,
        chartData: chartPoints,
      });
      const result = computeWidgetChartData(
        { ...baseWidget, collection: "faculty" },
        emptyCollections(),
      );
      expect(readFacultyWidgetAggregate).toHaveBeenCalledWith("w-1");
      expect(result).toEqual(chartPoints);
    });

    it("delegates contacts, students, sessions, and enrollments to their readers", () => {
      readContactsWidgetAggregate.mockReturnValue({ chartData: [{ name: "C", value: 1 }] });
      readStudentsWidgetAggregate.mockReturnValue({ chartData: [{ name: "S", value: 2 }] });
      readSessionsWidgetAggregate.mockReturnValue({ chartData: [{ name: "Se", value: 3 }] });
      readEnrollmentsWidgetAggregate.mockReturnValue(undefined);

      const col = emptyCollections();
      expect(computeWidgetChartData({ ...baseWidget, collection: "contacts" }, col)).toEqual([
        { name: "C", value: 1 },
      ]);
      expect(computeWidgetChartData({ ...baseWidget, collection: "students" }, col)).toEqual([
        { name: "S", value: 2 },
      ]);
      expect(computeWidgetChartData({ ...baseWidget, collection: "sessions" }, col)).toEqual([
        { name: "Se", value: 3 },
      ]);
      expect(computeWidgetChartData({ ...baseWidget, collection: "enrollments" }, col)).toEqual([]);
    });
  });

  describe("in-memory collection grouping and aggregation", () => {
    it("groups records by xAxisField and counts occurrences, defaulting missing values to Unknown", () => {
      const records = [
        { id: "1", status: "present" },
        { id: "2", status: "present" },
        { id: "3", status: "absent" },
        { id: "4", status: null },
      ];
      const col = emptyCollections({
        attendance_records: records as unknown as ReportCollectionsSnapshot["attendance_records"],
      });
      const result = computeWidgetChartData(
        {
          ...baseWidget,
          collection: "attendance_records",
          operation: "count",
          xAxisField: "status",
        },
        col,
      );
      expect(result).toEqual([
        { name: "present", value: 2 },
        { name: "absent", value: 1 },
        { name: "Unknown", value: 1 },
      ]);
    });

    it("computes sum aggregation for numeric targetField", () => {
      const invoices = [
        { id: "1", type: "Tuition", amount: 100 },
        { id: "2", type: "Tuition", amount: 50 },
        { id: "3", type: "Exam", amount: 30 },
      ];
      const col = emptyCollections({
        finance_invoices: invoices as unknown as ReportCollectionsSnapshot["finance_invoices"],
      });
      const result = computeWidgetChartData(
        {
          ...baseWidget,
          collection: "finance_invoices",
          operation: "sum",
          xAxisField: "type",
          targetField: "amount",
        },
        col,
      );
      expect(result).toEqual([
        { name: "Tuition", value: 150 },
        { name: "Exam", value: 30 },
      ]);
    });

    it("computes rounded avg aggregation for numeric targetField", () => {
      const invoices = [
        { id: "1", type: "Tuition", amount: 100 },
        { id: "2", type: "Tuition", amount: 55 },
      ];
      const col = emptyCollections({
        finance_invoices: invoices as unknown as ReportCollectionsSnapshot["finance_invoices"],
      });
      const result = computeWidgetChartData(
        {
          ...baseWidget,
          collection: "finance_invoices",
          operation: "avg",
          xAxisField: "type",
          targetField: "amount",
        },
        col,
      );
      expect(result).toEqual([{ name: "Tuition", value: 78 }]);
    });

    it("computes hasanat points based on denomination lookup", () => {
      const distributions = [
        { id: "1", category: "Charity", quantity: 2, denominationId: "d1" },
        { id: "2", category: "Charity", quantity: 1, denominationId: "d2" },
      ];
      const denoms = [
        { id: "d1", name: "Gold", points: 10 },
        { id: "d2", name: "Silver", points: 5 },
      ];
      const col = emptyCollections({
        hasanat_distributions:
          distributions as unknown as ReportCollectionsSnapshot["hasanat_distributions"],
        hasanat_denoms: denoms as unknown as ReportCollectionsSnapshot["hasanat_denoms"],
      });
      const result = computeWidgetChartData(
        {
          ...baseWidget,
          collection: "hasanat_distributions",
          operation: "sum",
          xAxisField: "category",
          targetField: "points",
        },
        col,
      );
      expect(result).toEqual([{ name: "Charity", value: 25 }]);
    });

    it("limits chart points to top 8 items sorted descending", () => {
      const records = Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        grade: `G${i}`,
        score: i * 10,
      }));
      const col = emptyCollections({
        attendance_records: records as unknown as ReportCollectionsSnapshot["attendance_records"],
      });
      const result = computeWidgetChartData(
        {
          ...baseWidget,
          collection: "attendance_records",
          operation: "sum",
          xAxisField: "grade",
          targetField: "score",
        },
        col,
      );
      expect(result).toHaveLength(8);
      expect(result[0]).toEqual({ name: "G11", value: 110 });
      expect(result[7]).toEqual({ name: "G4", value: 40 });
    });
  });
});
