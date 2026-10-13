import { describe, it, expect } from "vitest";
import {
  accountingReportAggregatesSchema,
  EMPTY_ACCOUNTING_REPORT_AGGREGATES,
} from "./accountingReportAggregates.js";

describe("accountingReportAggregates", () => {
  it("parses valid accounting report aggregates", () => {
    const parsed = accountingReportAggregatesSchema.parse({
      revenue: 50000,
      expenses: 30000,
      netSurplus: 20000,
      assets: 100000,
      liabilities: 20000,
      equity: 80000,
      trialBalance: [
        {
          id: "acc-1",
          code: "1000",
          name: "Cash",
          type: "Asset",
          totalDebit: 50000,
          totalCredit: 10000,
          balance: 40000,
        },
      ],
    });
    expect(parsed.revenue).toBe(50000);
    expect(parsed.trialBalance).toHaveLength(1);
  });

  it("provides sensible empty defaults", () => {
    const parsed = accountingReportAggregatesSchema.parse({});
    expect(parsed.revenue).toBe(0);
    expect(parsed.trialBalance).toEqual([]);
    expect(EMPTY_ACCOUNTING_REPORT_AGGREGATES.netSurplus).toBe(0);
  });
});
