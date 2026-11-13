import { describe, expect, it } from "vitest";
import { ACCOUNTING_ERROR_CODES, accountingErrorEnvelopeSchema } from "./accountingErrorCodes.js";
import { fxReportSchema } from "./accountingFxReport.js";
import {
  accountArchiveResponseSchema,
  accountingSeedChartResponseSchema,
  accountRestoreResponseSchema,
  accountsBulkArchiveResponseSchema,
  accountsBulkUpsertResponseSchema,
  bankStatementResponseSchema,
  entriesBulkUpsertResponseSchema,
  fiscalYearCloseResponseSchema,
  fiscalYearsBulkUpsertResponseSchema,
  fxRevaluationRunResponseSchema,
  fxRevaluationRunsResponseSchema,
  fxReportResponseSchema,
  openingBalancesPostedResponseSchema,
  postingPeriodResponseSchema,
  postingPeriodsResponseSchema,
  postingRulesResponseSchema,
  specializedEntryResponseSchema,
} from "./accountingHttpResponses.js";

const period = {
  id: "pp-1",
  fiscalYearId: "fy-1",
  label: "2026-01",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  status: "open" as const,
};

const fiscalYear = {
  id: "fy-1",
  label: "2025-2026",
  startDate: "2025-07-01",
  endDate: "2026-06-30",
  status: "closed" as const,
};

const statement = {
  id: "bs-1",
  accountId: "cash",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  openingBalance: 0,
  closingBalance: 100,
  lines: [],
};

describe("accounting response envelopes", () => {
  it("accept the shapes the ledger-ops routes send", () => {
    expect(postingRulesResponseSchema.safeParse({ rules: { arAccountId: "ar" } }).success).toBe(
      true,
    );
    expect(fiscalYearCloseResponseSchema.safeParse({ fiscalYear }).success).toBe(true);
    expect(postingPeriodsResponseSchema.safeParse({ periods: [period] }).success).toBe(true);
    expect(postingPeriodResponseSchema.safeParse({ period }).success).toBe(true);
    expect(bankStatementResponseSchema.safeParse({ statement }).success).toBe(true);
    expect(
      openingBalancesPostedResponseSchema.safeParse({ success: true, posted: false }).success,
    ).toBe(true);
  });

  it("reject a drifted payload instead of shipping it", () => {
    // A raw cents integer or a missing key is a server bug, not a response.
    expect(bankStatementResponseSchema.safeParse({ statement: { id: "bs-1" } }).success).toBe(
      false,
    );
    expect(
      postingPeriodResponseSchema.safeParse({ period: { ...period, status: "locked" } }).success,
    ).toBe(false);
  });

  it("accept the FX revaluation and report envelopes", () => {
    const run = {
      id: "fxr-1",
      revaluationDate: "2026-11-30",
      status: "posted",
      functionalCurrency: "PKR",
      totalUnrealized: "3000",
      entryId: "je-1",
      reversalEntryId: "je-2",
      lines: [],
    };
    expect(fxRevaluationRunsResponseSchema.safeParse({ runs: [run] }).success).toBe(true);
    expect(fxRevaluationRunResponseSchema.safeParse({ run }).success).toBe(true);
    expect(
      fxReportResponseSchema.safeParse({
        report: {
          from: "2026-11-01",
          asOf: "2026-11-30",
          functionalCurrency: "PKR",
          exposure: [
            {
              currency: "USD",
              openTxn: "1000.00",
              carryingFunc: "280000.00",
              closingRate: "283",
              revaluedFunc: "283000.00",
              unrealized: "3000.00",
            },
            {
              currency: "EUR",
              openTxn: "100.00",
              carryingFunc: "30000.00",
              closingRate: null,
              revaluedFunc: null,
              unrealized: null,
            },
          ],
          realized: [{ currency: "USD", realized: "500.00", payments: 2 }],
          totalRealized: "500.00",
          revaluations: [{ revaluationDate: "2026-11-30", totalUnrealized: "3000.00" }],
        },
      }).success,
    ).toBe(true);
  });

  it("validate the FX report directly, not just inside its envelope", () => {
    // A currency with no closing rate is reported unvalued, never valued at 1.
    expect(
      fxReportSchema.safeParse({
        from: "2026-11-01",
        asOf: "2026-11-30",
        functionalCurrency: "PKR",
        exposure: [],
        realized: [],
        totalRealized: "0.00",
        revaluations: [],
      }).success,
    ).toBe(true);
  });

  it("accept the specialized-entry, seed, archive and bulk-upsert envelopes", () => {
    expect(
      specializedEntryResponseSchema.safeParse({
        type: "salary",
        entryId: "je-1",
        ledgerPosted: true,
      }).success,
    ).toBe(true);
    expect(
      accountingSeedChartResponseSchema.safeParse({
        success: true,
        count: 42,
        defaultsApplied: { retainedEarnings: true, cashAccount: false },
      }).success,
    ).toBe(true);
    expect(accountArchiveResponseSchema.safeParse({ success: true, archived: true }).success).toBe(
      true,
    );
    expect(accountRestoreResponseSchema.safeParse({ success: true, restored: false }).success).toBe(
      true,
    );
    expect(
      accountsBulkArchiveResponseSchema.safeParse({ success: true, succeeded: 3, failed: 0 })
        .success,
    ).toBe(true);
    expect(accountsBulkUpsertResponseSchema.safeParse({ accounts: [] }).success).toBe(true);
    expect(entriesBulkUpsertResponseSchema.safeParse({ entries: [] }).success).toBe(true);
    expect(fiscalYearsBulkUpsertResponseSchema.safeParse({ fiscalYears: [] }).success).toBe(true);
  });
});

describe("accounting error envelope", () => {
  it("carries the stable code beside the coarse type", () => {
    expect(
      accountingErrorEnvelopeSchema.safeParse({
        type: "validation_error",
        message: "Posting period 2026-01 is closed — post into an open period",
        code: ACCOUNTING_ERROR_CODES.periodClosed,
      }).success,
    ).toBe(true);
  });

  it("keeps violations and details for clients that act on them", () => {
    const parsed = accountingErrorEnvelopeSchema.parse({
      type: "conflict",
      message: "Already reversed",
      code: ACCOUNTING_ERROR_CODES.voucherAlreadyReversed,
      violations: ["reversed"],
      details: { entryId: "je-1" },
    });
    expect(parsed.code).toBe("accounting.voucher.already-reversed");
    expect(parsed.violations).toEqual(["reversed"]);
  });

  it("has one code per distinct accounting rejection", () => {
    const codes = Object.values(ACCOUNTING_ERROR_CODES);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => code.startsWith("accounting."))).toBe(true);
  });
});
