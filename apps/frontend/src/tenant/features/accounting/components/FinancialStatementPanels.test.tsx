import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BalanceSheetPanel, CashFlowStatementPanel } from "./FinancialStatementPanels";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key} ${Object.values(params).join(" ")}` : key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({
    formatCurrency: (val: number) => `$${val}`,
  }),
}));

const assetRows = [
  {
    id: "bs-1",
    code: "1000",
    name: "Cash",
    type: "Asset",
    totalDebit: 10000,
    totalCredit: 0,
  },
  {
    id: "bs-2",
    code: "1100",
    name: "Buildings",
    type: "Asset",
    totalDebit: 40000,
    totalCredit: 0,
  },
];

describe("BalanceSheetPanel balance tolerance", () => {
  it("reports a sub-unit difference instead of calling the sheet balanced", () => {
    // The old `< 1` tolerance called a sheet off by 0.50 "balanced".
    const html = renderToStaticMarkup(
      <BalanceSheetPanel
        assetRows={[]}
        liabilityRows={[]}
        equityRows={[]}
        assets={100}
        liabilities={60}
        equity={39.5}
      />,
    );

    expect(html).not.toContain("accounting.reports.balanceSheetBalanced");
    expect(html).toContain("accounting.reports.balanceSheetDifference");
  });

  it("still calls an exactly-balanced sheet balanced", () => {
    const html = renderToStaticMarkup(
      <BalanceSheetPanel
        assetRows={[]}
        liabilityRows={[]}
        equityRows={[]}
        assets={100}
        liabilities={60}
        equity={40}
      />,
    );

    expect(html).toContain("accounting.reports.balanceSheetBalanced");
  });
});

describe("BalanceSheetPanel", () => {
  it("renders cumulative as-of rows and the server-computed equity total", () => {
    const html = renderToStaticMarkup(
      <BalanceSheetPanel
        assetRows={assetRows}
        liabilityRows={[]}
        equityRows={[
          {
            id: "bs-3",
            code: "3100",
            name: "Share Capital",
            type: "Equity",
            totalDebit: 0,
            totalCredit: 3000,
          },
        ]}
        assets={50000}
        liabilities={2000}
        equity={9000}
      />,
    );

    // An asset acquired before the window still belongs to the Balance Sheet.
    expect(html).toContain("Buildings");
    // Total Equity is the as-of server figure, not equityRows + range net surplus.
    expect(html).toContain("accounting.reports.totalEquity");
    expect(html).toContain("$9000");
    expect(html).toContain("accounting.reports.liabilitiesAndEquity");
    expect(html).toContain("$11000");
  });
});

describe("CashFlowStatementPanel", () => {
  const baseProps = {
    netSurplus: 2000,
    depreciationAdjustment: 100,
    receivablesChange: -500,
    payablesChange: 300,
    cashInflow: 5000,
    cashOutflow: 3100,
  };

  it("shows the indirect subtotal, the actual cash movement and no difference when they agree", () => {
    const html = renderToStaticMarkup(
      <CashFlowStatementPanel {...baseProps} netCashFlowIndirect={1900} netCashFlow={1900} />,
    );

    // Indirect-method build-up …
    expect(html).toContain("accounting.reports.cashflow.netSurplusOrDeficit");
    expect(html).toContain("accounting.reports.cashflow.depreciation");
    expect(html).toContain("accounting.reports.cashflow.receivables");
    expect(html).toContain("accounting.reports.cashflow.payables");
    // … the indirect subtotal and the direct-method cash movement are both shown.
    expect(html).toContain("accounting.reports.cashflow.netCashOperations");
    expect(html).toContain("accounting.reports.cashflow.netCashFlow");
    expect(html).toContain("$1900");
    expect(html).not.toContain("accounting.dashboard.difference");
  });

  it("renders an accessible difference line when indirect and direct cash flows disagree", () => {
    const html = renderToStaticMarkup(
      <CashFlowStatementPanel {...baseProps} netCashFlowIndirect={1900} netCashFlow={1500} />,
    );

    expect(html).toContain("accounting.dashboard.difference");
    expect(html).toContain("$400");
    expect(html).toContain('role="status"');
  });

  it("uses single valid Tailwind opacity steps", () => {
    const html = renderToStaticMarkup(
      <CashFlowStatementPanel {...baseProps} netCashFlowIndirect={1900} netCashFlow={1900} />,
    );

    expect(html).not.toContain("/10/60");
    expect(html).not.toContain("/10/50");
  });
});
