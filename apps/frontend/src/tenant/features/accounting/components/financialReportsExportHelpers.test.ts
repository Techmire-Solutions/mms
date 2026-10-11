import { describe, expect, it } from "vitest";
import type { AppTranslationKey } from "@mms/shared";
import {
  buildFinancialReportExportRows,
  getFinancialReportExportColumns,
  type TrialBalanceRow,
} from "./financialReportsExportHelpers";

describe("financialReportsExportHelpers", () => {
  const t = ((key: string) => key) as unknown as (key: AppTranslationKey) => string;
  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

  /** Range rows: the movement inside the requested window (Income Statement source). */
  const mockTb: TrialBalanceRow[] = [
    {
      id: "tb-1",
      code: "4000",
      name: "Tuition Fees",
      type: "Revenue",
      totalDebit: 0,
      totalCredit: 5000,
      balance: 5000,
    },
    {
      id: "tb-2",
      code: "5000",
      name: "Salaries",
      type: "Expense",
      totalDebit: 3000,
      totalCredit: 0,
      balance: -3000,
    },
    {
      id: "tb-3",
      code: "1000",
      name: "Cash",
      type: "Asset",
      totalDebit: 10000,
      totalCredit: 0,
      balance: 10000,
    },
    {
      id: "tb-4",
      code: "2000",
      name: "Accounts Payable",
      type: "Liability",
      totalDebit: 0,
      totalCredit: 2000,
      balance: -2000,
    },
    {
      id: "tb-5",
      code: "3000",
      name: "Retained Earnings",
      type: "Equity",
      totalDebit: 0,
      totalCredit: 6000,
      balance: 6000,
    },
  ];

  /**
   * Cumulative Asset/Liability/Equity rows as of `dateTo` (Balance Sheet source).
   * Differs from `mockTb` on purpose: "Buildings" was acquired before the window,
   * so it only exists in the as-of rows.
   */
  const mockBalanceSheetTb: TrialBalanceRow[] = [
    {
      id: "bs-1",
      code: "1000",
      name: "Cash",
      type: "Asset",
      totalDebit: 10000,
      totalCredit: 0,
      balance: 10000,
    },
    {
      id: "bs-2",
      code: "1100",
      name: "Buildings",
      type: "Asset",
      totalDebit: 40000,
      totalCredit: 0,
      balance: 40000,
    },
    {
      id: "bs-3",
      code: "2000",
      name: "Accounts Payable",
      type: "Liability",
      totalDebit: 0,
      totalCredit: 2000,
      balance: -2000,
    },
    {
      id: "bs-4",
      code: "3000",
      name: "Retained Earnings",
      type: "Equity",
      totalDebit: 0,
      totalCredit: 6000,
      balance: 6000,
    },
    {
      id: "bs-5",
      code: "3100",
      name: "Share Capital",
      type: "Equity",
      totalDebit: 0,
      totalCredit: 3000,
      balance: 3000,
    },
  ];

  const baseOptions = {
    tb: mockTb,
    balanceSheetTb: mockBalanceSheetTb,
    revenue: 5000,
    expenses: 3000,
    netSurplus: 2000,
    assets: 50000,
    liabilities: 2000,
    equity: 9000,
    depreciationAdjustment: 0,
    receivablesChange: 0,
    payablesChange: 2000,
    netCashFlowIndirect: 2000,
    netCashFlow: 2000,
    cashInflow: 5000,
    cashOutflow: 3000,
    formatCurrency,
    t,
  };

  it("returns 4 export columns with correct headers and keys", () => {
    const columns = getFinancialReportExportColumns(t);
    expect(columns).toHaveLength(4);
    expect(columns.map((c) => c.key)).toEqual(["section", "code", "account", "amount"]);
  });

  it("builds export rows for income statement", () => {
    const rows = buildFinancialReportExportRows({
      ...baseOptions,
      view: "income",
    });

    expect(rows.some((r) => r.account === "Tuition Fees" && r.amount === "$5000.00")).toBe(true);
    expect(
      rows.some((r) => r.account === "accounting.reports.totalRevenue" && r.amount === "$5000.00"),
    ).toBe(true);
    expect(rows.some((r) => r.account === "Salaries" && r.amount === "$3000.00")).toBe(true);
    expect(
      rows.some((r) => r.account === "accounting.reports.totalExpenses" && r.amount === "$3000.00"),
    ).toBe(true);
    expect(
      rows.some((r) => r.account === "accounting.reports.netSurplus" && r.amount === "$2000.00"),
    ).toBe(true);
  });

  it("builds export rows for balance sheet from the cumulative as-of rows", () => {
    const rows = buildFinancialReportExportRows({
      ...baseOptions,
      view: "balance",
    });

    expect(rows.some((r) => r.account === "Cash" && r.amount === "$10000.00")).toBe(true);
    // Assets acquired before the window must appear on the Balance Sheet …
    expect(rows.some((r) => r.account === "Buildings" && r.amount === "$40000.00")).toBe(true);
    // … and the range-based Income Statement accounts must not leak into it.
    expect(rows.some((r) => r.account === "Tuition Fees")).toBe(false);
    expect(rows.some((r) => r.account === "Salaries")).toBe(false);
    expect(
      rows.some((r) => r.account === "accounting.reports.totalAssets" && r.amount === "$50000.00"),
    ).toBe(true);
    expect(rows.some((r) => r.account === "Accounts Payable" && r.amount === "$2000.00")).toBe(
      true,
    );
    expect(
      rows.some(
        (r) => r.account === "accounting.reports.totalLiabilities" && r.amount === "$2000.00",
      ),
    ).toBe(true);
    expect(rows.some((r) => r.account === "Retained Earnings" && r.amount === "$6000.00")).toBe(
      true,
    );
    expect(rows.some((r) => r.account === "Share Capital" && r.amount === "$3000.00")).toBe(true);
    expect(
      rows.some((r) => r.account === "accounting.reports.totalEquity" && r.amount === "$9000.00"),
    ).toBe(true);
  });

  it("keeps the range rows as the income statement source", () => {
    const rows = buildFinancialReportExportRows({
      ...baseOptions,
      view: "income",
    });

    expect(rows.some((r) => r.account === "Buildings")).toBe(false);
  });

  it("builds reconciling export rows for cash flow statement", () => {
    const rows = buildFinancialReportExportRows({
      ...baseOptions,
      view: "cashflow",
      depreciationAdjustment: 100,
      receivablesChange: -500,
      payablesChange: 300,
      netCashFlowIndirect: 1900,
      netCashFlow: 1900,
      cashInflow: 5000,
      cashOutflow: 3100,
    });

    expect(
      rows.some(
        (r) =>
          r.account === "accounting.reports.cashflow.netSurplusOrDeficit" &&
          r.amount === "$2000.00",
      ),
    ).toBe(true);
    expect(
      rows.some(
        (r) => r.account === "accounting.reports.cashflow.depreciation" && r.amount === "$100.00",
      ),
    ).toBe(true);
    expect(
      rows.some(
        (r) => r.account === "accounting.reports.cashflow.receivables" && r.amount === "$-500.00",
      ),
    ).toBe(true);
    expect(
      rows.some(
        (r) => r.account === "accounting.reports.cashflow.payables" && r.amount === "$300.00",
      ),
    ).toBe(true);
    // Indirect subtotal and the direct-method cash movement are both exported.
    expect(
      rows.some(
        (r) =>
          r.account === "accounting.reports.cashflow.netCashOperations" && r.amount === "$1900.00",
      ),
    ).toBe(true);
    expect(
      rows.some(
        (r) => r.account === "accounting.reports.cashflow.netCashFlow" && r.amount === "$1900.00",
      ),
    ).toBe(true);
    expect(
      rows.some(
        (r) => r.account === "accounting.reports.cashflow.cashInflow" && r.amount === "$5000.00",
      ),
    ).toBe(true);
    expect(
      rows.some(
        (r) => r.account === "accounting.reports.cashflow.cashOutflow" && r.amount === "$3100.00",
      ),
    ).toBe(true);
    // Reconciled: no difference row.
    expect(rows.some((r) => r.account === "accounting.dashboard.difference")).toBe(false);
  });

  it("adds a difference row when the indirect and direct cash flows disagree", () => {
    const rows = buildFinancialReportExportRows({
      ...baseOptions,
      view: "cashflow",
      depreciationAdjustment: 100,
      netCashFlowIndirect: 1900,
      netCashFlow: 1500,
    });

    const differenceRow = rows.find((r) => r.account === "accounting.dashboard.difference");
    expect(differenceRow).toBeDefined();
    expect(differenceRow?.amount).toBe("$400.00");
  });
});
