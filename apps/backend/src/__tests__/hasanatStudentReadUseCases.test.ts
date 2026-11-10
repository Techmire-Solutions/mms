import { describe, expect, it, vi, beforeEach } from "vitest";
import type { HasanatTier } from "@mms/shared";
import { getHasanatStudentReport } from "../hasanat/use-cases/hasanatStudentReadUseCases.js";

const TIERS: HasanatTier[] = [
  { key: "bronze", name: "Bronze", minPoints: 0 },
  { key: "silver", name: "Silver", minPoints: 100 },
  { key: "gold", name: "Gold", minPoints: 250 },
];

vi.mock("../hasanat/use-cases/hasanatTierUseCases.js", () => ({
  loadHasanatTierLadder: vi.fn(async () => TIERS),
}));

vi.mock("../hasanat/repository/hasanatRepositoryAdapter.js", () => ({
  loadHasanatStudentReport: vi.fn(async () => [
    {
      studentId: "s-1",
      studentName: "Ali",
      className: "Class 1",
      faculty: "Main",
      earned: 150,
      balance: 100,
      redeemed: 50,
    },
    {
      studentId: "s-2",
      studentName: "Hassan",
      className: "Class 2",
      faculty: "Main",
      earned: 300,
      balance: 300,
      redeemed: 0,
    },
  ]),
}));

describe("hasanatStudentReadUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds student report with tier progress derivations", async () => {
    const report = await getHasanatStudentReport("demo", {});

    expect(report.tiers).toHaveLength(3);
    expect(report.rows).toHaveLength(2);

    const ali = report.rows.find((r) => r.studentId === "s-1");
    expect(ali).toBeDefined();
    expect(ali?.tierKey).toBe("silver");
    expect(ali?.tierName).toBe("Silver");
    expect(ali?.pointsToNext).toBe(100); // 250 - 150

    const hassan = report.rows.find((r) => r.studentId === "s-2");
    expect(hassan).toBeDefined();
    expect(hassan?.tierKey).toBe("gold");
    expect(hassan?.pointsToNext).toBe(0);
  });
});
