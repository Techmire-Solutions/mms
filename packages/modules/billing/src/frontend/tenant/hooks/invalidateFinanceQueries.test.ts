import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateFinanceQueries } from "./invalidateFinanceQueries";
import { FINANCE_INVOICES_QUERY_KEY } from "./financeQueryKeys";
const mockInvalidateAccounting = vi.fn();
vi.mock("../host/accountingCollection", () => ({
  invalidateAccountingQueries: (...args: unknown[]) => mockInvalidateAccounting(...args),
}));
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@mms/fe-core/query/dashboardQueryKeys";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@mms/fe-core/query/dynamicWidgetAggregatesQueryKey";

describe("invalidateFinanceQueries", () => {
  it("invalidates finance, accounting and dashboard data together", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    invalidateFinanceQueries(queryClient);

    const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(FINANCE_INVOICES_QUERY_KEY));
    // Finance postings write the ledger: Trial Balance/BS/IS, metrics, GL and aging.
    expect(mockInvalidateAccounting).toHaveBeenCalledWith(queryClient);
    expect(keys).toContain(JSON.stringify(DASHBOARD_SUMMARY_QUERY_KEY_ROOT));
    expect(keys).toContain(JSON.stringify(DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY));
  });
});
