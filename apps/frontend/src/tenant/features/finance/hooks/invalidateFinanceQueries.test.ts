import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateFinanceQueries } from "./invalidateFinanceQueries";
import { FINANCE_INVOICES_QUERY_KEY } from "./financeQueryKeys";
import {
  ACCOUNTING_ENTRIES_QUERY_KEY,
  ACCOUNTING_METRICS_QUERY_KEY,
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/hooks/collections/accounting";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";

describe("invalidateFinanceQueries", () => {
  it("invalidates finance, accounting and dashboard data together", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    invalidateFinanceQueries(queryClient);

    const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(FINANCE_INVOICES_QUERY_KEY));
    // Finance postings write the ledger: Trial Balance/BS/IS, metrics, GL and aging.
    expect(keys).toContain(JSON.stringify(ACCOUNTING_ENTRIES_QUERY_KEY));
    expect(keys).toContain(JSON.stringify(ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY));
    expect(keys).toContain(JSON.stringify(ACCOUNTING_METRICS_QUERY_KEY));
    expect(keys).toContain(JSON.stringify(DASHBOARD_SUMMARY_QUERY_KEY_ROOT));
    expect(keys).toContain(JSON.stringify(DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY));
  });
});
