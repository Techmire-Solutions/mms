import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_ACCOUNT_TYPES,
  ACCOUNT_SUBTYPES,
  accountingAccountsListQuerySchema,
  accountingEntriesListQuerySchema,
} from "./accountingListQuery.js";

/**
 * These filters were declared on `AccountingListQuery` and offered by the UI
 * (the Journal tab's status and date controls, the chart-of-accounts type
 * filter) but were absent from the REST query schemas, so ts-rest dropped them:
 * changing a filter refetched an identical, unfiltered page.
 */
describe("accounting list query schemas", () => {
  it("accepts the journal filters the UI sends", () => {
    const parsed = accountingEntriesListQuerySchema.parse({
      page: "2",
      limit: "100",
      search: "INV",
      status: "posted",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      accountId: "acc-1",
      tag: "fee",
      sortField: "date",
      sortDir: "desc",
    });
    expect(parsed).toMatchObject({
      page: 2,
      limit: 100,
      status: "posted",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      accountId: "acc-1",
      tag: "fee",
    });
  });

  it("caps the tag filter at the accounting_entry_tags column width", () => {
    // Without the server-side filter a paged list could only narrow the rows it
    // had already loaded, so a tag filter would show a subset of one page.
    expect(accountingEntriesListQuerySchema.safeParse({ tag: "fee" }).success).toBe(true);
    expect(accountingEntriesListQuerySchema.safeParse({ tag: "a".repeat(64) }).success).toBe(true);
    expect(accountingEntriesListQuerySchema.safeParse({ tag: "a".repeat(65) }).success).toBe(false);
  });

  it("rejects a status outside the journal-entry enum", () => {
    expect(accountingEntriesListQuerySchema.safeParse({ status: "cancelled" }).success).toBe(false);
    for (const status of ["posted", "draft"] as const) {
      expect(accountingEntriesListQuerySchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("keeps the shared page-size ceiling on both list queries", () => {
    // Asking for more than the contract allows is a 400, not a clamp.
    expect(accountingEntriesListQuerySchema.safeParse({ limit: 100 }).success).toBe(true);
    expect(accountingEntriesListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(accountingAccountsListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("accepts only real account types for the chart-of-accounts filter", () => {
    for (const accountType of ["Asset", "Liability", "Equity", "Revenue", "Expense"] as const) {
      expect(accountingAccountsListQuerySchema.safeParse({ accountType }).success).toBe(true);
    }
    expect(accountingAccountsListQuerySchema.safeParse({ accountType: "asset" }).success).toBe(
      false,
    );
    expect(accountingAccountsListQuerySchema.safeParse({ accountType: "Income" }).success).toBe(
      false,
    );
  });

  it("defines valid subtypes for every account type in ACCOUNT_SUBTYPES", () => {
    for (const accountType of ACCOUNTING_ACCOUNT_TYPES) {
      const subtypes = ACCOUNT_SUBTYPES[accountType];
      expect(subtypes).toBeDefined();
      expect(subtypes.length).toBeGreaterThan(0);
      for (const subtype of subtypes) {
        expect(typeof subtype).toBe("string");
        expect(subtype.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
