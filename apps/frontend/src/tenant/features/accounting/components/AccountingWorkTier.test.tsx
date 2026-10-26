import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingWorkTier } from "./AccountingWorkTier";
import { DEFAULT_ACCOUNTING_SETTINGS } from "@mms/shared";
import { EMPTY_JOURNAL_ENTRY_FILTERS } from "@/tenant/features/accounting/lib/journalEntriesControllerFilters";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./AccountingBankingPanel", () => ({
  AccountingBankingPanel: ({ canWrite, accounts }: { canWrite: boolean; accounts: unknown[] }) => (
    <div
      data-testid="accounting-banking-panel"
      data-canwrite={String(canWrite)}
      data-account-count={String(accounts.length)}
    />
  ),
}));

vi.mock("./AccountingPeriodEndPanel", () => ({
  AccountingPeriodEndPanel: ({
    canWrite,
    accounts,
    fiscalYears,
  }: {
    canWrite: boolean;
    accounts: unknown[];
    fiscalYears: unknown[];
  }) => (
    <div
      data-testid="accounting-period-end-panel"
      data-canwrite={String(canWrite)}
      data-account-count={String(accounts.length)}
      data-fy-count={String(fiscalYears.length)}
    />
  ),
}));

vi.mock("./AccountingDashboard", () => ({
  AccountingDashboard: () => <div data-testid="accounting-dashboard" />,
}));

vi.mock("./ChartOfAccounts", () => ({
  ChartOfAccounts: () => <div data-testid="accounting-coa" />,
}));

vi.mock("./GeneralLedger", () => ({
  GeneralLedger: () => <div data-testid="accounting-ledger" />,
}));

vi.mock("./JournalEntries", () => ({
  JournalEntries: () => <div data-testid="accounting-journal" />,
}));

vi.mock("./TrialBalance", () => ({
  TrialBalance: () => <div data-testid="accounting-trial" />,
}));

describe("AccountingWorkTier", () => {
  const baseProps = {
    subTabs: [
      { id: "overview", label: "Overview" },
      { id: "banking", label: "Banking" },
      { id: "periodEnd", label: "Period-end" },
    ],
    activeSubTab: "overview",
    canWrite: true,
    canDelete: true,
    showDeleted: false,
    listLoadFailed: false,
    accounts: [{ id: "acc-1" } as never],
    entries: [],
    aggregateEntries: [],
    settings: DEFAULT_ACCOUNTING_SETTINGS,
    fiscalYears: [{ id: "fy-1" } as never],
    journalFilters: EMPTY_JOURNAL_ENTRY_FILTERS,
    onJournalFiltersChange: vi.fn(),
    journalPaging: { page: 1, limit: 50, total: 0, hasMore: false, onPageChange: vi.fn() },
    onSubTabChange: vi.fn(),
    onShowDeletedChange: vi.fn(),
    onRetry: vi.fn(),
    onAccountsChange: vi.fn().mockResolvedValue(undefined),
    onEntriesChange: vi.fn(),
    onFilteredCountChange: vi.fn(),
    onDeleteEntry: vi.fn().mockResolvedValue(undefined),
    onRestoreEntry: vi.fn().mockResolvedValue(undefined),
    onBulkDeleteEntries: vi.fn().mockResolvedValue(undefined),
    onBulkRestoreEntries: vi.fn().mockResolvedValue(undefined),
  };

  it("given activeSubTab=banking, should render AccountingBankingPanel with canWrite", () => {
    const html = renderToStaticMarkup(
      <AccountingWorkTier {...baseProps} activeSubTab="banking" canWrite={true} />,
    );

    expect(html).toContain('data-testid="accounting-banking-panel"');
    expect(html).toContain('data-canwrite="true"');
    expect(html).toContain('data-account-count="1"');
    expect(html).not.toContain('data-testid="accounting-period-end-panel"');
  });

  it("given activeSubTab=banking and canWrite=false, should pass canWrite=false to Banking panel", () => {
    const html = renderToStaticMarkup(
      <AccountingWorkTier {...baseProps} activeSubTab="banking" canWrite={false} />,
    );

    expect(html).toContain('data-testid="accounting-banking-panel"');
    expect(html).toContain('data-canwrite="false"');
  });

  it("given activeSubTab=periodEnd, should render AccountingPeriodEndPanel with canWrite and data", () => {
    const html = renderToStaticMarkup(
      <AccountingWorkTier {...baseProps} activeSubTab="periodEnd" canWrite={true} />,
    );

    expect(html).toContain('data-testid="accounting-period-end-panel"');
    expect(html).toContain('data-canwrite="true"');
    expect(html).toContain('data-account-count="1"');
    expect(html).toContain('data-fy-count="1"');
    expect(html).not.toContain('data-testid="accounting-banking-panel"');
  });

  it("given listLoadFailed=true, should render error state instead of panels", () => {
    const html = renderToStaticMarkup(
      <AccountingWorkTier {...baseProps} activeSubTab="banking" listLoadFailed={true} />,
    );

    expect(html).not.toContain('data-testid="accounting-banking-panel"');
    expect(html).toContain("accounting.loadFailedHint");
  });
});
