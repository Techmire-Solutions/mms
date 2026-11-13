import { describe, expect, it } from "vitest";
import { accountingReportQuerySchema } from "./accountingReportAggregates.js";
import { accountingEntriesListQuerySchema } from "./accountingListQuery.js";
import {
  accountingLedgerQuerySchema,
  receivablesAgingQuerySchema,
} from "./accountingReportEndpoints.js";

describe("report date filters", () => {
  it("accepts a valid window in chronological order", () => {
    expect(
      accountingReportQuerySchema.parse({ dateFrom: "2026-01-01", dateTo: "2026-12-31" }),
    ).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-12-31" });
    expect(accountingReportQuerySchema.parse({})).toEqual({});
  });

  it("rejects malformed calendar dates before they reach the date column", () => {
    for (const value of ["2026-13-01", "2026-02-30", "not-a-date", "2026-1-1"]) {
      expect(accountingReportQuerySchema.safeParse({ dateFrom: value }).success).toBe(false);
      expect(accountingEntriesListQuerySchema.safeParse({ dateFrom: value }).success).toBe(false);
    }
  });

  it("rejects a reversed range", () => {
    expect(
      accountingReportQuerySchema.safeParse({ dateFrom: "2026-12-31", dateTo: "2026-01-01" })
        .success,
    ).toBe(false);
  });
});

describe("ledger and aging query contracts", () => {
  it("requires an account and validates the ledger window", () => {
    expect(accountingLedgerQuerySchema.safeParse({ accountId: "acc-1" }).success).toBe(true);
    expect(accountingLedgerQuerySchema.safeParse({}).success).toBe(false);
    expect(
      accountingLedgerQuerySchema.safeParse({ accountId: "acc-1", dateFrom: "bad" }).success,
    ).toBe(false);
    expect(
      accountingLedgerQuerySchema.safeParse({
        accountId: "acc-1",
        dateFrom: "2026-12-31",
        dateTo: "2026-01-01",
      }).success,
    ).toBe(false);
  });

  it("requires an as-of date for aging", () => {
    expect(receivablesAgingQuerySchema.parse({ asOf: "2026-06-30" })).toEqual({
      asOf: "2026-06-30",
    });
    expect(receivablesAgingQuerySchema.safeParse({}).success).toBe(false);
    expect(receivablesAgingQuerySchema.safeParse({ asOf: "30/06/2026" }).success).toBe(false);
  });
});
