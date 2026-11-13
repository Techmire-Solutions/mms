import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingDashboard } from "./AccountingDashboard";

type DashboardQueryStub = {
  data?: Record<string, unknown>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const state = vi.hoisted(() => ({
  metrics: {} as DashboardQueryStub,
  aggregates: {} as DashboardQueryStub,
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingApi", () => ({
  useAccountingMetrics: () => state.metrics,
  useAccountingReportAggregates: () => state.aggregates,
}));

vi.mock("@/lib/contexts/BrandingPaletteContext", () => ({
  useBrandPalette: () => ({ primary: "#0ea5e9", secondary: "#f97316", charts: ["#0ea5e9"] }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en" }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({ formatCurrency: (amount: number) => String(amount) }),
}));

describe("AccountingDashboard loading and error states", () => {
  const props = {
    accounts: [],
    entries: [],
    settings: {} as never,
    fiscalYears: [],
  };

  it("renders a busy skeleton while the server figures load", () => {
    state.metrics = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    const html = renderToStaticMarkup(<AccountingDashboard {...props} />);

    expect(html).toContain('aria-busy="true"');
    // The zero figures must not be presented as real balances while loading.
    expect(html).not.toContain("accounting.dashboard.revenueVsExpenses");
  });

  it("renders an error state with retry when the figures fail", () => {
    const refetch = vi.fn();
    state.metrics = { data: undefined, isLoading: false, isError: true, refetch };
    state.aggregates = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };
    const html = renderToStaticMarkup(<AccountingDashboard {...props} />);

    expect(html).toContain("accounting.dashboard.loadFailed");
    expect(html).toContain("accounting.dashboard.loadFailedHint");
  });

  it("never calls a balance sheet off by cents balanced", () => {
    // Regression: the old check was `Math.abs(assets - (liabilities + equity)) < 1`,
    // so 0.99 of imbalance (e.g. a rounding plug missing from Equity) rendered
    // "Balance Sheet is balanced".
    state.metrics = {
      data: {
        revenue: 10,
        expenses: 4,
        surplus: 6,
        assets: 100,
        liabilities: 60,
        posted: 1,
        draft: 0,
        newThisPeriod: 1,
        totalEntries: 1,
        activeAccounts: 2,
        inactiveAccounts: 0,
        postedVolume: 10,
        monthly: [],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    state.aggregates = {
      data: {
        equity: 39.5,
        netCashFlow: 0,
        incomeStatementTrialBalance: [],
        trialBalance: [],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    const html = renderToStaticMarkup(<AccountingDashboard {...props} />);

    expect(html).not.toContain("accounting.dashboard.balanceSheetBalanced");
    expect(html).toContain("accounting.dashboard.difference");
  });

  it("renders the charts once the figures settle", () => {
    state.metrics = {
      data: { revenue: 10, expenses: 4, surplus: 6, assets: 20, liabilities: 5 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    state.aggregates = {
      data: { equity: 15, monthly: [], incomeStatementTrialBalance: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    const html = renderToStaticMarkup(<AccountingDashboard {...props} />);

    expect(html).toContain("accounting.dashboard.revenueVsExpenses");
  });
});
