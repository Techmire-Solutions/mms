import { describe, expect, it } from "vitest";
import { accountingReportQuerySchema } from "./accountingReportAggregates.js";
import { accountingEntriesListQuerySchema } from "./accountingListQuery.js";
import {
  accountingLedgerQuerySchema,
  receivablesAgingQuerySchema,
  receivablesAgingSchema,
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

describe("aging pagination", () => {
  it("accepts a page and a bounded limit", () => {
    const parsed = receivablesAgingQuerySchema.parse({
      asOf: "2026-06-30",
      page: "2",
      limit: "50",
    });
    expect(parsed).toEqual({ asOf: "2026-06-30", page: 2, limit: 50 });
    expect(
      receivablesAgingQuerySchema.safeParse({ asOf: "2026-06-30", limit: "501" }).success,
    ).toBe(false);
    expect(receivablesAgingQuerySchema.safeParse({ asOf: "2026-06-30", page: "0" }).success).toBe(
      false,
    );
  });

  it("requires the page fields in the response so a client can page on", () => {
    const report = {
      asOf: "2026-06-30",
      rows: [],
      totals: {
        current: 0,
        d1_30: 0,
        d31_60: 0,
        d61_90: 0,
        d90_plus: 0,
        total: 0,
        invoiceCount: 0,
      },
      totalStudents: 120,
      page: 1,
      limit: 100,
      hasMore: true,
    };
    expect(receivablesAgingSchema.safeParse(report).success).toBe(true);
    const { page: _page, ...withoutPage } = report;
    expect(receivablesAgingSchema.safeParse(withoutPage).success).toBe(false);
  });
});
