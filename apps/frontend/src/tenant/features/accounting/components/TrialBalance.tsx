import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Table } from "@/components/ui/table";
import { WorkBatchTableFooter } from "@/components/common/work/WorkBatchTableFooter";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { moneyToCents } from "@mms/shared";
import {
  ACCOUNT_TYPES,
  type Account,
  type JournalEntry,
  type FiscalYear,
} from "@/lib/data/accountingData";
import { useAccountingReportAggregates } from "@/tenant/features/accounting/hooks/useAccountingApi";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { AccountingDateFilterBar } from "./AccountingDateFilterBar";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { balanceToneClass } from "@/lib/ui/semanticTone";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { TrialBalanceTypeGroup } from "./TrialBalanceTypeGroup";
import { exportTrialBalanceCsv } from "../lib/trialBalanceExport";

interface TrialBalanceProps {
  /**
   * Retained for call-site compatibility. The rows now come from the server's
   * own trial balance, so the component no longer needs the client collections —
   * and computing it here was the bug: it could only ever see the entries the
   * page had loaded, so the totals (and the "Balanced" badge) described a slice
   * of the ledger rather than the ledger.
   */
  accounts?: Account[];
  entries?: JournalEntry[];
  fiscalYears?: FiscalYear[];
}

export function TrialBalance({ fiscalYears }: TrialBalanceProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const { viewMode } = useWorkDirectoryViewMode();
  const activeFiscalYear = (fiscalYears || []).find((fiscalYear) => fiscalYear.status === "active");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hasUserSetRange, setHasUserSetRange] = useState(false);

  /**
   * A trial balance is a period statement, so the server's range rows are the
   * right set (`report-aggregates.trialBalance`). The fiscal-year list resolves
   * after first paint, so the default range is adopted once it lands; an explicit
   * user range — including "All time" — always wins.
   */
  useEffect(() => {
    if (hasUserSetRange || !activeFiscalYear) return;
    const { startDate, endDate } = activeFiscalYear;
    setDateFrom((prev) => (prev === startDate ? prev : startDate));
    setDateTo((prev) => (prev === endDate ? prev : endDate));
  }, [activeFiscalYear, hasUserSetRange]);

  const aggregatesResult = useAccountingReportAggregates({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const rows = aggregatesResult.data?.trialBalance ?? [];
  const isLoading = aggregatesResult.isLoading;
  const isError = aggregatesResult.isError;

  // Integer cents for exactness, and the totals must be non-zero for a balance
  // to mean anything (an empty period trivially "balances").
  const grandDebitCents = rows.reduce(
    (sum, trialBalanceRow) => sum + moneyToCents(trialBalanceRow.totalDebit),
    0,
  );
  const grandCreditCents = rows.reduce(
    (sum, trialBalanceRow) => sum + moneyToCents(trialBalanceRow.totalCredit),
    0,
  );
  const grandDebit = grandDebitCents / 100;
  const grandCredit = grandCreditCents / 100;
  const isBalanced = grandDebitCents === grandCreditCents && grandDebitCents > 0;

  const formatPositiveNumber = (amount: number) => (amount > 0 ? formatCurrency(amount) : "—");

  const exportCSV = () => exportTrialBalanceCsv(rows, grandDebit, grandCredit, t);

  return (
    <div className="space-y-4">
      <AccountingDateFilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(value) => {
          setHasUserSetRange(true);
          setDateFrom(value);
        }}
        onDateToChange={(value) => {
          setHasUserSetRange(true);
          setDateTo(value);
        }}
        activeFiscalYear={activeFiscalYear}
        onExportCSV={exportCSV}
        idPrefix="tb"
      />

      {isError && (
        <ErrorState
          title={t("accounting.loadFailed")}
          description={t("accounting.loadFailedHint")}
          onRetry={() => {
            void aggregatesResult.refetch();
          }}
        />
      )}

      {!isError && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border",
            balanceToneClass(isBalanced),
          )}
          role="status"
        >
          {isBalanced ? (
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          )}
          {isBalanced
            ? t("accounting.tb.balancedMessage", { total: formatCurrency(grandDebit) })
            : t("accounting.tb.unbalancedMessage", {
                diff: formatCurrency(Math.abs(grandDebit - grandCredit)),
              })}
        </div>
      )}

      {!isError && isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : !isError && rows.length === 0 ? (
        <EmptyState
          variant="dashed"
          title={t("accounting.ledger.noPostedTransactionsPeriod")}
          compact
        />
      ) : isError ? null : (
        <>
          {ACCOUNT_TYPES.map((type) => (
            <TrialBalanceTypeGroup
              key={type}
              type={type}
              accountTypeRows={rows.filter((trialBalanceRow) => trialBalanceRow.type === type)}
              formatPositiveNumber={formatPositiveNumber}
            />
          ))}

          <div className="rounded-xl border-2 border-foreground/20 overflow-hidden bg-muted/30">
            {viewMode === "cards" ? (
              <div className="p-3">
                <article className={WORK_SURFACE_INNER}>
                  <p className="text-sm font-bold uppercase tracking-wide text-foreground m-0 mb-2">
                    {t("accounting.tb.grandTotal")}
                  </p>
                  <StatGrid>
                    <StatRow
                      label={t("accounting.columns.journal.debit")}
                      value={formatCurrency(grandDebit)}
                      ddClassName="font-mono font-bold text-info text-base"
                    />
                    <StatRow
                      label={t("accounting.columns.journal.credit")}
                      value={formatCurrency(grandCredit)}
                      ddClassName="font-mono font-bold text-success text-base"
                    />
                  </StatGrid>
                </article>
              </div>
            ) : (
              <Table>
                <caption className="sr-only">{t("accounting.tb.grandTotalCaption")}</caption>
                <WorkBatchTableFooter
                  footerRow={{
                    cells: [
                      {
                        colSpan: 3,
                        className:
                          "px-3 py-2.5 text-sm font-bold text-foreground uppercase tracking-wide",
                        content: t("accounting.tb.grandTotal"),
                      },
                      {
                        className: "table-amount-cell px-3 py-2.5 text-info text-base",
                        content: formatCurrency(grandDebit),
                        align: "end",
                      },
                      {
                        className: "table-amount-cell px-3 py-2.5 text-success text-base",
                        content: formatCurrency(grandCredit),
                        align: "end",
                      },
                    ],
                  }}
                />
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
