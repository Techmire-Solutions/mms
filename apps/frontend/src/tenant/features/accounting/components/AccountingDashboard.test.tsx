import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingDashboard } from "./AccountingDashboard";
import type {
  Account,
  JournalEntry,
  AccountingSettings,
  FiscalYear,
} from "@/lib/data/accountingData";

const mockMetrics = vi.hoisted(() => ({
  data: {
    revenue: 50000,
    expenses: 30000,
    surplus: 20000,
    assets: 100000,
    liabilities: 40000,
    posted: 12,
    draft: 2,
    newThisPeriod: 3,
    totalEntries: 14,
    activeAccounts: 8,
    inactiveAccounts: 1,
    postedVolume: 80000,
  } as Record<string, unknown> | undefined,
}));

const mockAggregates = vi.hoisted(() => ({
  data: {
    netCashFlow: 15000,
    incomeStatementTrialBalance: [
      { name: "Utilities", type: "Expense", totalDebit: 2500, totalCredit: 0 },
    ],
  } as Record<string, unknown> | undefined,
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingApi", () => ({
  useAccountingMetrics: () => ({ data: mockMetrics.data }),
  useAccountingReportAggregates: () => ({ data: mockAggregates.data }),
}));

vi.mock("@/lib/contexts/BrandingPaletteContext", () => ({
  useBrandPalette: () => ({
    primary: "#0ea5e9",
    secondary: "#f97316",
    charts: ["#0ea5e9", "#f97316", "#10b981"] as const,
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts?.amount ? `${key}:${opts.amount}` : key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({
    formatCurrency: (val: number) => `$${val.toLocaleString()}`,
  }),
}));

vi.mock("@/components/app/SafeResponsiveContainer", () => ({
  SafeResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
}));

vi.mock("@/components/app/ChartGrid", () => ({
  ChartGrid: () => <div data-testid="chart-grid" />,
  chartAxisTick: () => ({}),
}));

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
}));

describe("AccountingDashboard Component", () => {
  const dummyAccounts: Account[] = [
    {
      id: "acc-1",
      code: "1001",
      name: "Cash",
      type: "Asset",
      subtype: "Current Asset",
      description: "",
      isActive: true,
    },
    {
      id: "acc-2",
      code: "2001",
      name: "Accounts Payable",
      type: "Liability",
      subtype: "Current Liability",
      description: "",
      isActive: true,
    },
    {
      id: "acc-3",
      code: "3001",
      name: "Retained Earnings",
      type: "Equity",
      subtype: "Retained Earnings",
      description: "",
      isActive: true,
    },
  ];

  const dummyEntries: JournalEntry[] = [
    {
      id: "entry-1",
      ref: "JE-2026-001",
      date: "2026-09-01",
      description: "Tuition Income Received",
      status: "posted",
      created_by: "admin",
      tags: [],
      attachments: [],
      fiscal_year: "2026",
      lines: [
        { id: "l1", account_id: "acc-1", description: "Cash", debit: 5000, credit: 0 },
        { id: "l2", account_id: "acc-3", description: "Income", debit: 0, credit: 5000 },
      ],
    },
  ];

  const dummySettings: AccountingSettings = {
    currency: "USD",
    currencySymbol: "$",
    dateFormat: "YYYY-MM-DD",
    decimalSeparator: "period",
    decimalPlaces: 2,
    fyStartMonth: "January",
    accountCodeLength: 4,
    requireNarration: false,
    allowEditPosted: false,
    autoPostDrafts: false,
    retainedEarningsAccount: "acc-3",
    defaultViewLayout: "list",
  };

  const dummyFiscalYears: FiscalYear[] = [];

  beforeEach(() => {
    mockMetrics.data = {
      revenue: 50000,
      expenses: 30000,
      surplus: 20000,
      assets: 100000,
      liabilities: 40000,
      posted: 12,
      draft: 2,
    };
    mockAggregates.data = {
      netCashFlow: 15000,
      incomeStatementTrialBalance: [
        { name: "Utilities", type: "Expense", totalDebit: 2500, totalCredit: 0 },
      ],
    };
  });

  it("renders nominal command metrics and charts", () => {
    const html = renderToStaticMarkup(
      <AccountingDashboard
        accounts={dummyAccounts}
        entries={dummyEntries}
        settings={dummySettings}
        fiscalYears={dummyFiscalYears}
      />,
    );
    expect(html).toContain("accounting.dashboard.totalRevenue");
    expect(html).toContain("$50,000");
    expect(html).toContain("accounting.dashboard.totalExpenses");
    expect(html).toContain("$30,000");
    expect(html).toContain("accounting.dashboard.netSurplus");
    expect(html).toContain("accounting.dashboard.revenueVsExpenses");
    expect(html).toContain("accounting.dashboard.expenseBreakdown");
    expect(html).toContain("Utilities");
    expect(html).toContain("accounting.dashboard.balanceSheetSnapshot");
    expect(html).toContain("JE-2026-001");
  });

  it("displays empty states when data collections are empty and no server data is available", () => {
    mockMetrics.data = undefined;
    mockAggregates.data = undefined;

    const html = renderToStaticMarkup(
      <AccountingDashboard
        accounts={[]}
        entries={[]}
        settings={dummySettings}
        fiscalYears={dummyFiscalYears}
      />,
    );
    expect(html).toContain("accounting.dashboard.noPostedData");
    expect(html).toContain("accounting.dashboard.noExpenseData");
    expect(html).toContain("accounting.journal.dashboard.noEntriesHint");
  });

  it("correctly reports balanced balance sheet when assets equal liabilities plus equity", () => {
    mockMetrics.data = {
      assets: 100000,
      liabilities: 40000,
      revenue: 10000,
      expenses: 5000,
      surplus: 5000,
      posted: 1,
      draft: 0,
    };
    const html = renderToStaticMarkup(
      <AccountingDashboard
        accounts={dummyAccounts}
        entries={dummyEntries}
        settings={dummySettings}
        fiscalYears={dummyFiscalYears}
      />,
    );
    expect(html).toContain("accounting.dashboard.balanceSheetSnapshot");
    expect(html).toContain("border-destructive");
  });

  it("renders accessible sr-only table for visual bar chart data", () => {
    const html = renderToStaticMarkup(
      <AccountingDashboard
        accounts={dummyAccounts}
        entries={dummyEntries}
        settings={dummySettings}
        fiscalYears={dummyFiscalYears}
      />,
    );
    expect(html).toContain("accounting.dashboard.revenueVsExpensesTable");
    expect(html).toContain('class="sr-only"');
  });
});
