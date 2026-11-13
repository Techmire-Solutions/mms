import { describe, expect, it } from "vitest";
import {
  accountingExchangeRateLookupResponseSchema,
  accountingExchangeRatesResponseSchema,
  hedgeRelationshipListResponseSchema,
  hedgeRelationshipResponseSchema,
  ias29RunResponseSchema,
  journalReversalResultSchema,
} from "./accountingHttpResponses.js";
import { hedgeListQuerySchema } from "./accountingHedgeSchemas.js";
import { baseListQuerySchema, emptyQuerySchema } from "../core/apiSchemas.js";
import { resourceIdParamsSchema } from "../schemas/api.dto.js";

const rate = {
  id: "fx-1",
  fromCurrency: "USD",
  toCurrency: "PKR",
  rateDate: "2026-11-01",
  rateType: "SPOT",
  rate: "281",
  source: "manual",
  overrideReason: "",
};

describe("accounting response envelopes", () => {
  it("accepts a canonical exchange-rate list", () => {
    expect(accountingExchangeRatesResponseSchema.safeParse({ rates: [rate] }).success).toBe(true);
  });

  it("rejects a rate with more decimals than the rate scale allows", () => {
    const result = accountingExchangeRatesResponseSchema.safeParse({
      rates: [{ ...rate, rate: "281.00000000001" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a lookup body that claims a missing rate instead of a 404", () => {
    expect(accountingExchangeRateLookupResponseSchema.safeParse({ rate: null }).success).toBe(
      false,
    );
  });

  it("requires the additive truncation flag on the hedge list", () => {
    expect(hedgeRelationshipListResponseSchema.safeParse({ hedges: [] }).success).toBe(false);
    expect(
      hedgeRelationshipListResponseSchema.safeParse({ hedges: [], truncated: false }).success,
    ).toBe(true);
  });

  it("rejects unknown keys on a hedge payload", () => {
    const hedge = {
      id: "hedge-1",
      name: "USD import",
      hedgeType: "cash_flow",
      direction: "buy",
      currency: "USD",
      notional: "1000",
      contractRate: "283",
      designationRate: "285",
      designationDate: "2026-10-01",
      maturityDate: "2027-01-31",
      hedgedItem: "Forecast USD purchase",
      riskManagementObjective: "Fix the PKR cost of the import",
      instrumentAccountId: "deriv",
      reserveAccountId: "cfhr",
      pnlAccountId: "hpl",
      status: "active",
      settledReserve: "0",
      valuations: [],
    };
    expect(hedgeRelationshipResponseSchema.safeParse({ hedge }).success).toBe(true);
    expect(
      hedgeRelationshipResponseSchema.safeParse({ hedge: { ...hedge, leaked: "x" } }).success,
    ).toBe(false);
  });

  it("validates the reversal result the route publishes", () => {
    const result = {
      entry: {
        id: "je-rev",
        date: "2026-10-08",
        ref: "REV-JV-1",
        description: "Reversal of JV-1",
        status: "posted",
        created_by: "Amina",
        tags: ["Reversal"],
        attachments: [],
        fiscal_year: "2026",
        lines: [{ id: "l1", account_id: "cash", debit: 100, credit: 0, description: "" }],
      },
      original: { id: "je-orig", ref: "JV-1", date: "2026-09-15" },
      priorPeriod: false,
      executedAt: "2026-10-08T09:30:00.000Z",
    };
    expect(journalReversalResultSchema.safeParse(result).success).toBe(true);
    const { original: _original, ...missingLink } = result;
    expect(journalReversalResultSchema.safeParse(missingLink).success).toBe(false);
  });

  it("validates the IAS 29 run envelope", () => {
    const run = {
      id: "ias29-1",
      restatementDate: "2026-12-31",
      status: "posted",
      closingIndex: "125",
      netMonetaryResult: "-100",
      entryId: "je-1",
      reversalEntryId: "je-2",
      lines: [
        {
          accountId: "land",
          accountCode: "1500",
          accountName: "Land",
          carrying: "600",
          restated: "750",
          adjustment: "150",
        },
      ],
    };
    expect(ias29RunResponseSchema.safeParse({ run }).success).toBe(true);
  });
});

describe("bounded request fields", () => {
  it("rejects an id longer than the shared cap", () => {
    expect(resourceIdParamsSchema.safeParse({ id: "x".repeat(129) }).success).toBe(false);
    expect(resourceIdParamsSchema.safeParse({ id: "x".repeat(128) }).success).toBe(true);
  });

  it("rejects an unbounded cursor or sort field", () => {
    expect(baseListQuerySchema.safeParse({ afterId: "x".repeat(129) }).success).toBe(false);
    expect(baseListQuerySchema.safeParse({ sortField: "x".repeat(65) }).success).toBe(false);
    expect(baseListQuerySchema.safeParse({ afterId: "je-1", sortField: "date" }).success).toBe(
      true,
    );
  });

  it("rejects any query parameter on a no-parameter GET", () => {
    expect(emptyQuerySchema.safeParse({}).success).toBe(true);
    expect(emptyQuerySchema.safeParse({ date: "2026-12-31" }).success).toBe(false);
  });

  it("bounds the hedge page size", () => {
    expect(hedgeListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(hedgeListQuerySchema.safeParse({ limit: 5 }).success).toBe(true);
    expect(hedgeListQuerySchema.safeParse({}).success).toBe(true);
  });
});
