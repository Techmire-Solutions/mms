import { describe, expect, it } from "vitest";
import { dashboardContract } from "../contracts/dashboard.contract.js";

const summaryQuery = dashboardContract.getSummary.query;

describe("dashboard summary query", () => {
  it("accepts a calendar date plus the presentation-only role hint", () => {
    const parsed = summaryQuery.safeParse({ date: "2026-08-27", role: "admin" });
    expect(parsed.success).toBe(true);
  });

  it("rejects values that would become arbitrary Redis cache-key segments", () => {
    for (const date of ["today", "2026-08-27:*", "2026-13-99", "x".repeat(120)]) {
      expect(summaryQuery.safeParse({ date }).success).toBe(false);
    }
  });

  it("stays optional for the default dashboard load", () => {
    expect(summaryQuery.safeParse(undefined).success).toBe(true);
  });
});
