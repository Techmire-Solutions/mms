import React from "react";
import type {
  Account,
  JournalEntry,
  AccountingSettings,
  FiscalYear,
} from "@/lib/data/accountingData";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";
import { useAccountingDashboardView } from "./useAccountingDashboardView";
import { AccountingDashboardCharts } from "./AccountingDashboardCharts";
import { AccountingDashboardSnapshots } from "./AccountingDashboardSnapshots";

export interface AccountingDashboardProps {
  accounts: Account[];
  entries: JournalEntry[];
  settings: AccountingSettings;
  fiscalYears: FiscalYear[];
}

/**
 * Accounting Dashboard — P&L StatCards prefer server `/metrics`; charts use journal collections.
 * Decoupled into presentational modules and custom view hook per ADR-001 & ADR-002 (≤300 LOC).
 */
export function AccountingDashboard({
  accounts,
  entries,
  settings: _settings,
  fiscalYears: _fiscalYears,
}: AccountingDashboardProps) {
  const {
    t,
    formatCurrency,
    primary,
    secondary,
    pieColors,
    metricItems,
    monthlyData,
    expenseBreakdown,
    bsData,
    isBalanced,
    balanceDifference,
    recentEntries,
  } = useAccountingDashboardView(accounts, entries);

  return (
    <section aria-label={t("accounting.dashboard.aria")} className="space-y-5">
      <ModuleCommandMetricsGrid items={metricItems} />

      <AccountingDashboardCharts
        monthlyData={monthlyData}
        expenseBreakdown={expenseBreakdown}
        primary={primary}
        secondary={secondary}
        pieColors={pieColors}
        formatCurrency={formatCurrency}
      />

      <AccountingDashboardSnapshots
        bsData={bsData}
        isBalanced={isBalanced}
        balanceDifference={balanceDifference}
        recentEntries={recentEntries}
        formatCurrency={formatCurrency}
      />
    </section>
  );
}
