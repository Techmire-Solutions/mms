import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, ArrowUpDown, AlertTriangle } from "lucide-react";
import { Alert } from "@/components/app/Alert";
import { centsToMoney, type JournalEntry, type Account } from "@/lib/data/accountingData";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { WorkTaskToolbar } from "@/components/common/work";
import { buildDataTableRegistry, toColumnCustomizer } from "@/components/common/data-table";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import {
  buildCashbookRows,
  countCashbookRowsByType,
  resolveCashAccountIds,
  sumCashbookTotals,
  type EntryType,
} from "@/tenant/features/accounting/lib/cashbookViewShared";
import { CashbookViewTable } from "@/tenant/features/accounting/components/CashbookViewTable";
import {
  useCashbookColumns,
  type CashbookVoucherAction,
} from "@/tenant/features/accounting/components/useCashbookColumns";

interface CashbookViewProps {
  entries: JournalEntry[];
  accounts: Account[];
  /**
   * Cash/bank account configured in Setup → posting rules, when the caller has
   * it. It is always treated as cash even if its code/name look nothing like it.
   */
  configuredCashAccountId?: string | null;
  pageScopeLabel?: string;
  voucher?: CashbookVoucherAction;
}

export function CashbookView({
  entries,
  accounts,
  configuredCashAccountId,
  pageScopeLabel,
  voucher,
}: CashbookViewProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<EntryType | "all">("all");
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const { columns } = useCashbookColumns(formatCurrency, voucher);
  const tenantRegistry = useMemo(() => buildDataTableRegistry(columns), [columns]);
  const columnLayout = useModuleColumnLayout({ moduleId: "accounting.cashbook", tenantRegistry });

  /**
   * Cash accounts are resolved from the chart itself (Asset accounts whose
   * code/subtype/name say cash or bank) instead of the seed chart's literal ids,
   * which only existed for workspaces seeded with that exact chart.
   */
  const cashAccountIds = (() => resolveCashAccountIds(accounts, configuredCashAccountId))();

  const rows = (() => buildCashbookRows(entries, search, filterType, t, { cashAccountIds }))();
  const countByType = (() => countCashbookRowsByType(rows))();

  /**
   * Totals are summed in integer cents (see `sumCashbookTotals`) and converted
   * exactly once — currency is money, and a float reduce can turn 0.1 + 0.2 into
   * 0.30000000000000004 in the figures the user reconciles against.
   */
  const { totalIn, totalOut, balance } = (() => {
    const { totalInCents, totalOutCents, balanceCents } = sumCashbookTotals(rows);
    return {
      totalIn: centsToMoney(totalInCents),
      totalOut: centsToMoney(totalOutCents),
      balance: centsToMoney(balanceCents),
    };
  })();

  return (
    <div className="space-y-4">
      {pageScopeLabel && (
        <p className="m-0 text-xs text-muted-foreground" role="status">
          {pageScopeLabel}
        </p>
      )}
      <section aria-label={t("accounting.cashbook.summaryAria")}>
        <ModuleCommandMetricsGrid
          items={[
            {
              icon: TrendingUp,
              label: t("accounting.cashbook.moneyIn"),
              value: formatCurrency(totalIn),
              accent: "success",
            },
            {
              icon: TrendingDown,
              label: t("accounting.cashbook.moneyOut"),
              value: formatCurrency(totalOut),
              accent: "destructive",
            },
            {
              icon: ArrowUpDown,
              label: t("accounting.cashbook.netBalance"),
              value: formatCurrency(Math.abs(balance)),
              accent: balance >= 0 ? "success" : "destructive",
            },
          ]}
        />
      </section>

      {/*
        Classification is only as good as the chart: say so out loud rather than
        rendering a silently empty or all-transfer cashbook.
      */}
      {cashAccountIds.size === 0 && (
        <Alert density="compact" description={t("accounting.cashbook.noCashAccount")} />
      )}
      {countByType.unclassified > 0 && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground m-0"
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          {t("accounting.cashbook.unclassifiedCount", { count: countByType.unclassified })}
        </p>
      )}

      <WorkTaskToolbar
        regionLabel={t("accounting.cashbook.filterAria")}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("reports.widgets.searchRecords")}
        searchId="cashbook-search"
        hasActiveFilters={search.length > 0 || filterType !== "all"}
        onClearFilters={() => {
          setSearch("");
          setFilterType("all");
        }}
        clearFiltersLabel={t("common.clearFilters")}
        statusFilter={{
          activeIds: filterType === "all" ? [] : [filterType],
          onToggle: (id) => setFilterType(id === filterType ? "all" : (id as EntryType)),
          allLabel: t("accounting.cashbook.all"),
          onResetAll: () => setFilterType("all"),
          options: [
            { id: "in", label: t("accounting.cashbook.moneyIn") },
            { id: "out", label: t("accounting.cashbook.moneyOut") },
            { id: "transfer", label: t("accounting.cashbook.transfers") },
            { id: "unclassified", label: t("accounting.cashbook.unclassified") },
          ],
        }}
        viewModeToggle={{ viewMode, onViewModeChange: setViewMode }}
        columnCustomizer={toColumnCustomizer(columnLayout)}
      />

      <CashbookViewTable
        rows={rows}
        totalIn={totalIn}
        totalOut={totalOut}
        formatCurrency={formatCurrency}
        viewMode={viewMode}
        columnLayout={columnLayout}
        voucher={voucher}
      />
    </div>
  );
}
