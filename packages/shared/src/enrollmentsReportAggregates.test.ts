import { describe, expect, it } from "vitest";
import {
  computeEnrollmentsCumulativeTrends,
  computeEnrollmentsReportPanels,
  enrollmentsReportAggregatesSchema,
  normalizeEnrollmentsReportComparisonQuery,
} from "./enrollmentsReportAggregates.js";

describe("enrollmentsReportAggregates", () => {
  it("parses a valid aggregates payload", () => {
    const parsed = enrollmentsReportAggregatesSchema.parse({
      cumulativeTrends: [
        { monthKey: "2026-01", students: 2 },
        { monthKey: "2026-02", students: 5 },
      ],
      statusCounts: { pending: 1, confirmed: 2, cancelled: 0, completed: 1, total: 4 },
      fees: { due: 300, paid: 100 },
      bySession: [{ sessionId: "ses-1", name: "Hifz", count: 3, revenue: 250 }],
      comparison: {
        sessions: [{ sessionId: "ses-1", enrollmentCount: 2, studentIds: ["stu-1"] }],
        monthly: {
          a: [{ monthKey: "2026-01", count: 2 }],
          b: [{ monthKey: "2026-02", count: 1 }],
        },
      },
    });
    expect(parsed.cumulativeTrends).toHaveLength(2);
    expect(parsed.statusCounts.total).toBe(4);
    expect(parsed.bySession[0]?.name).toBe("Hifz");
    expect(parsed.comparison?.sessions[0]?.enrollmentCount).toBe(2);
  });

  it("normalizeEnrollmentsReportComparisonQuery caps sessionIds and validates dates", () => {
    expect(
      normalizeEnrollmentsReportComparisonQuery({
        sessionIds: [" s1 ", "", "s2", "s3"],
        rangeAFrom: "2026-01-01",
        rangeATo: "2026-03-31",
        rangeBFrom: "bad",
        rangeBTo: "2026-06-30",
      }),
    ).toEqual({
      sessionIds: ["s1", "s2"],
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-03-31",
    });
    expect(normalizeEnrollmentsReportComparisonQuery({})).toBeUndefined();
  });

  it("computeEnrollmentsCumulativeTrends is cumulative not monthly-new", () => {
    const now = new Date(2026, 2, 15); // Mar 2026
    const trends = computeEnrollmentsCumulativeTrends(
      ["2026-01-10", "2026-01-20", "2026-02-05", "2026-03-01"],
      3,
      now,
    );
    expect(trends).toEqual([
      { monthKey: "2026-01", students: 2 },
      { monthKey: "2026-02", students: 3 },
      { monthKey: "2026-03", students: 4 },
    ]);
    // Monthly-new would be [2, 1, 1] — cumulative must keep growing.
    expect(trends[1]!.students).toBeGreaterThan(trends[0]!.students);
    expect(trends[2]!.students).toBeGreaterThan(trends[1]!.students);
  });

  it("computeEnrollmentsReportPanels mirrors EnrollmentReports reductions", () => {
    const panels = computeEnrollmentsReportPanels([
      {
        sessionId: "ses-1",
        sessionName: "Hifz",
        status: "confirmed",
        paymentStatus: "paid",
        finalFee: 100,
      },
      {
        sessionId: "ses-1",
        sessionName: "Hifz",
        status: "pending",
        paymentStatus: "pending",
        finalFee: 50,
      },
      {
        sessionId: "ses-2",
        sessionName: "Nazira",
        status: "cancelled",
        paymentStatus: "none",
        finalFee: 80,
      },
      {
        sessionId: "ses-2",
        sessionName: "Nazira",
        status: "completed",
        paymentStatus: "paid",
        finalFee: 40,
      },
    ]);

    expect(panels.statusCounts).toEqual({
      pending: 1,
      confirmed: 1,
      cancelled: 1,
      completed: 1,
      total: 4,
    });
    expect(panels.fees).toEqual({ due: 190, paid: 140 });
    expect(panels.bySession).toEqual([
      { sessionId: "ses-1", name: "Hifz", count: 2, revenue: 150 },
      { sessionId: "ses-2", name: "Nazira", count: 2, revenue: 40 },
    ]);
  });
});
