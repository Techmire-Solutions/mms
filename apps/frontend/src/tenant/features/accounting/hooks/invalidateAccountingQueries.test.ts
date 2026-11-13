import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAccountingQueries } from "./invalidateAccountingQueries";
import { ACCOUNTING_ENTRIES_QUERY_KEY } from "./accountingQueryKeys";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";

const UNRELATED_FINANCE_KEY = ["finance", "invoices"] as const;

describe("invalidateAccountingQueries", () => {
  it("refreshes accounting keys and dashboard data without touching finance", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    invalidateAccountingQueries(queryClient);

    const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(ACCOUNTING_ENTRIES_QUERY_KEY));
    expect(keys).toContain(JSON.stringify(DASHBOARD_SUMMARY_QUERY_KEY_ROOT));
    expect(keys).not.toContain(JSON.stringify(UNRELATED_FINANCE_KEY));
  });
});
