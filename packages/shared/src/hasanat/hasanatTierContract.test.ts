import { describe, expect, it } from "vitest";
import {
  hasanatStudentReportResponseSchema,
  hasanatStudentSummarySchema,
  hasanatTierReconcileResponseSchema,
} from "./hasanatTierContract.js";

const TIER = { key: "bronze", name: "Bronze", minPoints: 0 };

describe("hasanat tier contract schemas", () => {
  it("validates the reconcile result", () => {
    expect(
      hasanatTierReconcileResponseSchema.parse({ students: 3, awarded: 1, revoked: 2 }),
    ).toEqual({ students: 3, awarded: 1, revoked: 2 });
    expect(() => hasanatTierReconcileResponseSchema.parse({ students: 3 })).toThrow();
  });

  it("validates a student summary with its awards", () => {
    const summary = {
      studentId: "s1",
      earned: 120,
      balance: 70,
      redeemed: 50,
      tier: TIER,
      nextTier: { key: "silver", name: "Silver", minPoints: 100 },
      pointsToNext: 0,
      percentToNext: 100,
      awards: [
        {
          id: "a1",
          tierKey: "bronze",
          tierName: "Bronze",
          earnedSnapshot: 120,
          awardedAt: "2026-11-10T00:00:00.000Z",
        },
      ],
    };
    expect(hasanatStudentSummarySchema.parse(summary)).toMatchObject({ studentId: "s1" });
    expect(() =>
      hasanatStudentSummarySchema.parse({ ...summary, awards: [{ id: "a1" }] }),
    ).toThrow();
  });

  it("validates a report response row set", () => {
    const report = {
      rows: [
        {
          studentId: "s1",
          studentName: "Fatima",
          className: "Class A",
          faculty: "Ustadha",
          earned: 120,
          balance: 70,
          redeemed: 50,
          tierKey: "bronze",
          tierName: "Bronze",
          pointsToNext: 0,
          percentToNext: 100,
        },
      ],
      tiers: [TIER],
    };
    expect(hasanatStudentReportResponseSchema.parse(report)).toEqual(report);
  });
});
