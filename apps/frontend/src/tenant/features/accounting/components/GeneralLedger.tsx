import React from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type Account } from "@/lib/data/accountingData";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useGeneralLedger,
  type GeneralLedgerLineWithRunning,
} from "@/tenant/features/accounting/hooks/useGeneralLedger";
import { fetchAllAccountingLedgerLines } from "@/tenant/features/accounting/hooks/accountingListFetch";
import { exportGeneralLedgerCsv } from "@/tenant/features/accounting/lib/generalLedgerExport";
import { useAccountingLedgerExport } from "@/tenant/features/accounting/hooks/useAccountingLedgerExport";
import { GeneralLedgerFilters } from "@/tenant/features/accounting/components/GeneralLedgerFilters";
import { GeneralLedgerAccountSummary } from "@/tenant/features/accounting/components/GeneralLedgerAccountSummary";
import { GeneralLedgerEntries } from "@/tenant/features/accounting/components/GeneralLedgerEntries";

interface GeneralLedgerProps {
  accounts: Account[];
}

/**
 * GeneralLedger component.
 *
 * Displays the ledger for a specific account.
 */
export function GeneralLedger({ accounts }: GeneralLedgerProps) {
  const { t } = useTranslation();
  const ledger = useGeneralLedger(accounts);
  const { queueLedgerExport, isQueuing: isQueuingFullExport } = useAccountingLedgerExport();
  const pageCount = Math.max(1, Math.ceil(ledger.total / ledger.pageSize));

  const exportCSV = async () => {
    if (!ledger.activeAccount) return;
    const exportData = await fetchAllAccountingLedgerLines(
      ledger.activeAccount.id,
      ledger.dateFrom || undefined,
      ledger.dateTo || undefined,
    );
    const rows: GeneralLedgerLineWithRunning[] = exportData.lines.map((line) => ({
      date: line.date,
      ref: line.ref,
      description: line.description,
      lineDesc: line.lineDescription,
      debit: line.debit,
      credit: line.credit,
      running: line.running,
    }));
    exportGeneralLedgerCsv(ledger.activeAccount, rows, t);
    if (exportData.truncated) {
      notify.warning(t("accounting.ledger.exportTruncated", { count: rows.length }));
    }
  };

  return (
    <section aria-label={t("accounting.ledger.aria")} className="space-y-4">
      <GeneralLedgerFilters
        typeFilter={ledger.typeFilter}
        selectedAccount={ledger.selectedAccount}
        dateFrom={ledger.dateFrom}
        dateTo={ledger.dateTo}
        filteredAccounts={ledger.filteredAccounts}
        onTypeFilterChange={ledger.setTypeFilter}
        onSelectedAccountChange={ledger.setSelectedAccount}
        onDateFromChange={ledger.setDateFrom}
        onDateToChange={ledger.setDateTo}
      />

      {!ledger.selectedAccount && (
        <EmptyState variant="dashed" title={t("accounting.ledger.selectInstruction")} compact />
      )}

      {ledger.selectedAccount && ledger.activeAccount && (
        <>
          <GeneralLedgerAccountSummary
            activeAccount={ledger.activeAccount}
            totalDebit={ledger.totalDebit}
            totalCredit={ledger.totalCredit}
            balance={ledger.balance}
            onExport={exportCSV}
            isExportingFull={isQueuingFullExport}
            onExportFull={() => {
              if (!ledger.activeAccount) return;
              void queueLedgerExport({
                accountId: ledger.activeAccount.id,
                dateFrom: ledger.dateFrom || undefined,
                dateTo: ledger.dateTo || undefined,
              });
            }}
          />
          {ledger.isError ? (
            <EmptyState variant="dashed" title={t("accounting.ledger.loadFailed")} compact />
          ) : ledger.isLoading && ledger.total === 0 ? (
            <div className="space-y-2" role="status" aria-busy="true">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : (
            <GeneralLedgerEntries
              activeAccount={ledger.activeAccount}
              linesWithRunning={ledger.linesWithRunning}
              totalDebit={ledger.totalDebit}
              totalCredit={ledger.totalCredit}
              balance={ledger.balance}
              dateFrom={ledger.dateFrom}
              dateTo={ledger.dateTo}
            />
          )}
          {pageCount > 1 && (
            <nav
              aria-label={t("accounting.ledger.paginationAria")}
              className="flex items-center justify-between gap-3"
            >
              <Button
                size="sm"
                variant="outline"
                disabled={ledger.page <= 1 || ledger.isLoading}
                onClick={() => ledger.setPage(ledger.page - 1)}
              >
                {t("common.previous")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("accounting.ledger.pageOf", { page: ledger.page, pages: pageCount })}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={!ledger.hasMore || ledger.isLoading}
                onClick={() => ledger.setPage(ledger.page + 1)}
              >
                {t("common.next")}
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
