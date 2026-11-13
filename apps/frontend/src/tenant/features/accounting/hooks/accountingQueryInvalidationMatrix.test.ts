import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAccountingQueries } from "./invalidateAccountingQueries";
import { invalidateExchangeRateQueries } from "./useAccountingFx";
import { invalidateSpecializedEntryQueries } from "./useAccountingMutations";
import {
  ACCOUNTING_ACCOUNTS_QUERY_KEY,
  ACCOUNTING_ENTRIES_LIST_PREFIX,
  ACCOUNTING_FISCAL_YEARS_QUERY_KEY,
  ACCOUNTING_METRICS_QUERY_KEY,
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
} from "./accountingQueryKeys";
import { ACCOUNTING_PREFERENCES_QUERY_KEY } from "./useAccountingSetupConfig";
import { VOUCHER_NUMBERING_QUERY_KEY } from "./useVoucherNumbering";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";

/**
 * Every key a ledger write must refresh. The ledger and aging endpoints live under
 * the entries prefix, so a single prefix invalidation reaches them; the report
 * aggregates, setup and voucher numbering are separate lists and each one has
 * historically been missed at least once.
 */
const LEDGER_KEYS: readonly (readonly unknown[])[] = [
  ACCOUNTING_ENTRIES_LIST_PREFIX,
  [...ACCOUNTING_ENTRIES_LIST_PREFIX, "ledger", "acc-1", undefined, undefined, 1, 100],
  [...ACCOUNTING_ENTRIES_LIST_PREFIX, "aging", "2026-11-30", 1],
  [...ACCOUNTING_ENTRIES_LIST_PREFIX, "detail", "je-1"],
  [...ACCOUNTING_ENTRIES_LIST_PREFIX, "page", "{}"],
  ACCOUNTING_ACCOUNTS_QUERY_KEY,
  [...ACCOUNTING_ACCOUNTS_QUERY_KEY, "all", { includeDeleted: false }],
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
  [...ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY, "2026-01-01", "2026-12-31"],
  ACCOUNTING_METRICS_QUERY_KEY,
  ACCOUNTING_FISCAL_YEARS_QUERY_KEY,
  ACCOUNTING_PREFERENCES_QUERY_KEY,
  VOUCHER_NUMBERING_QUERY_KEY,
];

const DASHBOARD_KEYS: readonly (readonly unknown[])[] = [
  DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
  DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
];

const FX_KEYS: readonly (readonly unknown[])[] = [
  ["accounting", "fx", "exchange-rates", {}],
  ["accounting", "fx", "rate-lookup", { from: "USD" }],
  ["accounting", "fx", "report", "2026-11-01", "2026-11-30"],
];

function seed(client: QueryClient, keys: readonly (readonly unknown[])[]): void {
  for (const key of keys) client.setQueryData(key, "seed");
}

function invalidated(client: QueryClient, keys: readonly (readonly unknown[])[]): boolean[] {
  return keys.map((key) => client.getQueryState(key)?.isInvalidated === true);
}

describe("accounting cache invalidation matrix", () => {
  it("a ledger write refreshes every ledger, report and dashboard key", () => {
    const client = new QueryClient();
    seed(client, [...LEDGER_KEYS, ...DASHBOARD_KEYS]);

    invalidateAccountingQueries(client);

    expect(invalidated(client, LEDGER_KEYS).every(Boolean)).toBe(true);
    expect(invalidated(client, DASHBOARD_KEYS).every(Boolean)).toBe(true);
  });

  it("an exchange-rate save also refreshes the FX report", () => {
    const client = new QueryClient();
    seed(client, [...FX_KEYS, ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY]);

    invalidateExchangeRateQueries(client);

    expect(FX_KEYS.map((key) => client.getQueryState(key)?.isInvalidated === true)).toEqual([
      true,
      true,
      true,
    ]);
    // Reports can show rate-derived figures.
    expect(client.getQueryState(ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY)?.isInvalidated).toBe(true);
  });

  it("a fee/salary posting reaches the dashboard keys outside the module prefixes", () => {
    const client = new QueryClient();
    seed(client, [
      ["accounting", "entries", "list"],
      ["finance", "invoices"],
      ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
      ...DASHBOARD_KEYS,
    ]);

    invalidateSpecializedEntryQueries(client);

    expect(client.getQueryState(["accounting", "entries", "list"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["finance", "invoices"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY)?.isInvalidated).toBe(true);
    expect(invalidated(client, DASHBOARD_KEYS).every(Boolean)).toBe(true);
  });
});
