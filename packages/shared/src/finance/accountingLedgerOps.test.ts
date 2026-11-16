import { describe, expect, it } from "vitest";
import {
  bankStatementInsertSchema,
  openingBalanceInsertSchema,
  openingBalancesReplaceSchema,
  postingRulesUpdateSchema,
} from "./accountingLedgerOps.js";
import { invoicesBulkStatusSchema } from "./financeModuleManifest.js";

describe("accountingLedgerOps schemas", () => {
  it("rejects an opening-balance row that is debited and credited at once", () => {
    // A double-sided row yields a line that fails `isJournalLineSingleSided`, so
    // the whole entry was refused with the unrelated "Opening balances must form
    // a balanced journal" error. Rejecting it at the edge says what is wrong.
    const both = { fiscalYearId: "fy-1", accountId: "acc-1", debit: 100, credit: 100 };
    expect(openingBalanceInsertSchema.safeParse(both).success).toBe(false);

    expect(openingBalanceInsertSchema.safeParse({ ...both, credit: 0 }).success).toBe(true);
    expect(openingBalanceInsertSchema.safeParse({ ...both, debit: 0 }).success).toBe(true);
    // An explicit zero on the unused side is still fine.
    expect(
      openingBalanceInsertSchema.safeParse({
        fiscalYearId: "fy-1",
        accountId: "acc-1",
        debit: 0,
        credit: 0,
      }).success,
    ).toBe(true);
  });

  it("surfaces the single-sided violation through the replace payload", () => {
    const payload = {
      fiscalYearId: "fy-1",
      balances: [{ fiscalYearId: "fy-1", accountId: "acc-1", debit: 5, credit: 5 }],
    };
    const result = openingBalancesReplaceSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["balances", 0, "debit"]);
  });

  it("accepts an empty posting-rules update and rejects unknown keys", () => {
    expect(postingRulesUpdateSchema.safeParse({}).success).toBe(true);
    expect(postingRulesUpdateSchema.safeParse({ arAccountId: "acc-1" }).success).toBe(true);
    expect(postingRulesUpdateSchema.safeParse({ nope: "acc-1" }).success).toBe(false);
  });
});

describe("invoicesBulkStatusSchema", () => {
  it("allows only ledger-neutral statuses", () => {
    // 'paid' posts no payment and 'cancelled' posts no reversal, so both left the
    // subledger and the ledger permanently disagreeing.
    for (const status of ["pending", "overdue", "partial"] as const) {
      expect(invoicesBulkStatusSchema.safeParse({ ids: ["inv-1"], status }).success).toBe(true);
    }
    expect(
      invoicesBulkStatusSchema.safeParse({ ids: ["inv-1"], status: "cancelled" }).success,
    ).toBe(false);
    expect(invoicesBulkStatusSchema.safeParse({ ids: ["inv-1"], status: "paid" }).success).toBe(
      false,
    );
  });

  it("requires at least one invoice id", () => {
    expect(invoicesBulkStatusSchema.safeParse({ ids: [], status: "overdue" }).success).toBe(false);
  });
});

describe("bankStatementInsertSchema", () => {
  it("rejects a statement whose opening + movements do not equal the closing balance", () => {
    const balanced = {
      accountId: "bank-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      openingBalance: 100,
      closingBalance: 130,
      lines: [
        { date: "2026-01-05", description: "deposit", amount: 50 },
        { date: "2026-01-10", description: "withdrawal", amount: -20 },
      ],
    };

    expect(bankStatementInsertSchema.safeParse(balanced).success).toBe(true);
    expect(bankStatementInsertSchema.safeParse({ ...balanced, closingBalance: 140 }).success).toBe(
      false,
    );
  });

  it("requires opening to equal closing when there are no lines", () => {
    const base = {
      accountId: "bank-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      openingBalance: 100,
      closingBalance: 100,
      lines: [],
    };

    expect(bankStatementInsertSchema.safeParse(base).success).toBe(true);
    expect(bankStatementInsertSchema.safeParse({ ...base, closingBalance: 101 }).success).toBe(
      false,
    );
  });
});
