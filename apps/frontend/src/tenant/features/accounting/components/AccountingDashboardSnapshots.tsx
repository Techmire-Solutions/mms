import React from "react";
import { formatDate } from "@mms/shared";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { CARD_STRIPE_INSET } from "@/lib/semanticTone";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { JournalEntry } from "@/lib/data/accountingData";
import type { BalanceSheetItem } from "./useAccountingDashboardView";

export interface AccountingDashboardSnapshotsProps {
  bsData: BalanceSheetItem[];
  isBalanced: boolean;
  balanceDifference: number;
  recentEntries: JournalEntry[];
  formatCurrency: (amount: number) => string;
}

export function AccountingDashboardSnapshots({
  bsData,
  isBalanced,
  balanceDifference,
  recentEntries,
  formatCurrency,
}: AccountingDashboardSnapshotsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card accentColor="primary" className={cn("p-5", CARD_STRIPE_INSET)}>
        <h3 className="text-sm font-bold text-foreground mb-4 m-0">
          {t("accounting.dashboard.balanceSheetSnapshot")}
        </h3>
        <div className="space-y-3">
          {bsData.map((item) => (
            <div key={item.id} aria-label={`${item.name}: ${formatCurrency(item.value)}`}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-foreground">{item.name}</span>
                <span className="font-mono font-bold text-foreground">
                  {formatCurrency(item.value)}
                </span>
              </div>
              <ProgressBar
                value={item.percentage}
                size="md"
                fillClassName={item.colorClass}
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
        <div
          className={`mt-4 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg text-foreground border ${isBalanced ? "border-success bg-background shadow-sm" : "border-destructive bg-background shadow-sm"}`}
        >
          {isBalanced ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-success" aria-hidden="true" />
              <span>{t("accounting.dashboard.balanceSheetBalanced")}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-destructive" aria-hidden="true" />
              <span>
                {t("accounting.dashboard.difference", {
                  amount: formatCurrency(balanceDifference),
                })}
              </span>
            </>
          )}
        </div>
      </Card>

      <Card accentColor="warning" className={cn("p-5", CARD_STRIPE_INSET)}>
        <h3 className="text-sm font-bold text-foreground mb-4 m-0">
          {t("accounting.dashboard.recentEntries")}
        </h3>
        <div className="space-y-2">
          {recentEntries.length === 0 ? (
            <EmptyState
              title={t("accounting.dashboard.noPostedData")}
              description={t("accounting.journal.dashboard.noEntriesHint")}
              compact
              variant="dashed"
            />
          ) : (
            recentEntries.map((journalEntry) => {
              const totalDebit = journalEntry.lines.reduce((sum, line) => sum + line.debit, 0);
              return (
                <article
                  key={journalEntry.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${journalEntry.status === "posted" ? "bg-success/15" : "bg-warning/15"}`}
                    aria-hidden="true"
                  >
                    {journalEntry.status === "posted" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-primary font-mono m-0">
                      {journalEntry.ref}
                    </p>
                    <p className="text-xs text-foreground truncate m-0">
                      {journalEntry.description}
                    </p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-xs font-mono font-bold text-foreground m-0">
                      {formatCurrency(totalDebit)}
                    </p>
                    <p className="text-xs text-muted-foreground m-0">
                      {formatDate(journalEntry.date)}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
