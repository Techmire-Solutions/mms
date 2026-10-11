import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpeningBalance } from "@mms/shared";
import { ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY } from "@/tenant/features/accounting/hooks/useAccountingApi";

const mocks = vi.hoisted(() => ({
  apiJson: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => ({
  apiJson: mocks.apiJson,
}));

import {
  parseMoneyInput,
  useCloseFiscalYear,
  useOpeningBalances,
  useSaveAccountingPostingRules,
} from "./useAccountingLedgerOps";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("accounting ledger ops hooks", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    mocks.apiJson.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
  });

  function renderProbe(node: React.ReactNode): void {
    act(() => {
      root.render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
    });
  }

  it("sends the retained-earnings account explicitly when closing a fiscal year", async () => {
    mocks.apiJson.mockResolvedValue({ fiscalYear: { id: "fy1", status: "closed" } });
    let closeFiscalYear: ReturnType<typeof useCloseFiscalYear> | null = null;

    function Probe(): React.JSX.Element {
      closeFiscalYear = useCloseFiscalYear();
      return <div />;
    }
    renderProbe(<Probe />);

    await act(async () => {
      await closeFiscalYear!.mutateAsync({ id: "fy1", retainedEarningsAccountId: "acc-equity-1" });
    });

    const [url, init] = mocks.apiJson.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/accounting/fiscal-years/fy1/close");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ retainedEarningsAccountId: "acc-equity-1" }));
  });

  it("omits the body key entirely when no retained-earnings account was chosen", async () => {
    mocks.apiJson.mockResolvedValue({ fiscalYear: { id: "fy1", status: "closed" } });
    let closeFiscalYear: ReturnType<typeof useCloseFiscalYear> | null = null;

    function Probe(): React.JSX.Element {
      closeFiscalYear = useCloseFiscalYear();
      return <div />;
    }
    renderProbe(<Probe />);

    await act(async () => {
      await closeFiscalYear!.mutateAsync({ id: "fy1" });
    });

    // The body schema is `.strict()`, so `{"retainedEarningsAccountId":undefined}`
    // must never reach it — `{}` lets the server fall back to the preference.
    expect((mocks.apiJson.mock.calls[0] as [string, RequestInit])[1].body).toBe("{}");
  });

  it("invalidates the report aggregates after saving posting rules", async () => {
    mocks.apiJson.mockResolvedValue({ rules: {} });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    let saveRules: ReturnType<typeof useSaveAccountingPostingRules> | null = null;

    function Probe(): React.JSX.Element {
      saveRules = useSaveAccountingPostingRules();
      return <div />;
    }
    renderProbe(<Probe />);

    await act(async () => {
      await saveRules!.mutateAsync({ cashAccountId: "acc-cash" });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey?: unknown })?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY);
  });

  it("keeps the previous year's opening balances visible while the next year loads", async () => {
    mocks.apiJson.mockImplementation(async (url: string) => {
      if (url.includes("fiscalYearId=fy1")) {
        return {
          balances: [{ id: "ob-1", fiscalYearId: "fy1", accountId: "acc-1", debit: 10, credit: 0 }],
        };
      }
      return new Promise(() => {}) as Promise<{ balances: OpeningBalance[] }>;
    });

    let hookResult: ReturnType<typeof useOpeningBalances> | null = null;
    function Probe({ fiscalYearId }: { fiscalYearId: string }): React.JSX.Element {
      hookResult = useOpeningBalances(fiscalYearId);
      return <div />;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe fiscalYearId="fy1" />
        </QueryClientProvider>,
      );
    });
    // Separate act block: effects (and therefore the fetch) only flush when the
    // render act ends, and TanStack Query notifies on a macrotask.
    await act(async () => {
      for (let tick = 0; tick < 5; tick += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
    expect(hookResult!.data?.[0]?.id).toBe("ob-1");

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe fiscalYearId="fy2" />
        </QueryClientProvider>,
      );
    });

    // Previous data is still present (as a placeholder) rather than `undefined`:
    // the panel PUTs a full replacement, so an empty list there used to delete
    // every stored balance for the newly selected year.
    expect(hookResult!.data?.[0]?.id).toBe("ob-1");
    expect(hookResult!.isPlaceholderData).toBe(true);
  });

  it("parses money inputs with the configured decimal separator", () => {
    expect(parseMoneyInput("1,234.56", "period")).toBe(1234.56);
    expect(parseMoneyInput("1.234,56", "comma")).toBe(1234.56);
    expect(parseMoneyInput("1234.56", "period")).toBe(1234.56);
    expect(parseMoneyInput("1234,56", "comma")).toBe(1234.56);
    expect(parseMoneyInput("", "period")).toBeNull();
    expect(parseMoneyInput("abc", "period")).toBeNull();
    expect(parseMoneyInput("-25.5", "period")).toBe(-25.5);
    // Ambiguous input must be rejected, never silently rescaled: on a period
    // workspace a comma is a thousands separator, so "1,50" is neither a valid
    // group nor a valid decimal and `Number("1.234")` on a comma workspace
    // would have stored 1.234 instead of 1234.
    expect(parseMoneyInput("1,50", "period")).toBeNull();
    expect(parseMoneyInput("1,50", "comma")).toBe(1.5);
    expect(parseMoneyInput("1.234", "period")).toBe(1.234);
    expect(parseMoneyInput("1.234", "comma")).toBe(1234);
    expect(parseMoneyInput("25.5", "comma")).toBeNull();
  });
});
