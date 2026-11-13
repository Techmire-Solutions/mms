import React from "react";
import type {
  Account,
  JournalEntry,
  AccountingSettings,
  FiscalYear,
} from "@/lib/data/accountingData";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { ErrorState } from "@/components/app/ErrorState";
import { TableSkeleton } from "@shared/ui";
import { useAccountingDashboardView } from "../hooks/useAccountingDashboardView";
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
    isLoading,
    isError,
    refetch,
  } = useAccountingDashboardView(accounts, entries);

  if (isError) {
    return (
      <section aria-label={t("accounting.dashboard.aria")}>
        <ErrorState
          title={t("accounting.dashboard.loadFailed")}
          description={t("accounting.dashboard.loadFailedHint")}
          onRetry={refetch}
        />
      </section>
    );
  }

  if (isLoading) {
    return (
      <section aria-label={t("accounting.dashboard.aria")} className="space-y-5" aria-busy="true">
        <TableSkeleton rows={2} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5">
            <TableSkeleton rows={6} />
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <TableSkeleton rows={6} />
          </div>
        </div>
      </section>
    );
  }

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
