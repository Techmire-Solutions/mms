import React from "react";
import { getInitials } from "@mms/shared";
import { StatGrid, StatRow } from "@/components/ui/StatGrid";
import { ReportMoneyCard } from "@/components/ui/reports/ReportMoneyCard";
import { ReportMoneyCardsGrid } from "@/components/ui/reports/ReportMoneyCardsGrid";
import { ReportMoneySummaryTile } from "@/components/ui/reports/ReportMoneySummaryTile";
import { useTranslation } from "@/hooks/useTranslation";
import type { RepSummaryEntry } from "./ObligationsRepDuesSection";

/** ReportMoneyCard tile (report) — not DirectoryCard. */
export interface ObligationsRepDuesCardsViewProps {
  repSummary: RepSummaryEntry[];
  totalAmount: number;
  totalDue: number;
  formatCurrency: (amount: number | string | null | undefined) => string;
  formatValueOnly: (amount: number | string | null | undefined) => string;
}

export function ObligationsRepDuesCardsView({
  repSummary,
  totalAmount,
  totalDue,
  formatCurrency,
  formatValueOnly,
}: ObligationsRepDuesCardsViewProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ReportMoneyCardsGrid surface>
      {repSummary.map((representativeSummary) => (
        <ReportMoneyCard
          key={representativeSummary.key}
          header={
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <span className="text-xs font-bold text-primary">
                  {getInitials(representativeSummary.repName)}
                </span>
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm m-0">
                  {representativeSummary.repName}
                </h4>
                <p className="text-xs text-muted-foreground m-0">
                  {representativeSummary.mujtahidName}
                </p>
              </div>
            </div>
          }
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              {t("obligations.summary.rep.colByType")}
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(representativeSummary.byType).map(([name, amount]) => (
                <span
                  key={name}
                  className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted border border-border text-foreground whitespace-nowrap"
                >
                  {name}: {formatValueOnly(amount)}
                </span>
              ))}
            </div>
          </div>
          <StatGrid columns="sm3">
            <StatRow
              label={t("obligations.summary.rep.colCollections")}
              value={representativeSummary.count}
              ddClassName="text-sm font-semibold"
            />
            <StatRow
              label={t("obligations.summary.rep.colTotalCollectedShort")}
              value={formatCurrency(representativeSummary.total)}
              ddClassName="font-mono font-bold text-sm"
            />
            <StatRow
              label={t("obligations.summary.rep.colDueToRepShort")}
              value={formatCurrency(representativeSummary.due)}
              dtClassName="text-destructive"
              ddClassName="font-mono font-bold text-destructive text-sm"
            />
          </StatGrid>
        </ReportMoneyCard>
      ))}
      <ReportMoneySummaryTile
        label={t("obligations.summary.rep.repCount", { count: repSummary.length })}
      >
        <StatGrid>
          <StatRow
            label={t("obligations.summary.rep.colTotalCollectedShort")}
            value={formatCurrency(totalAmount)}
            ddClassName="font-mono font-bold text-xs"
          />
          <StatRow
            label={t("obligations.summary.rep.colDueToRepShort")}
            value={formatCurrency(totalDue)}
            dtClassName="text-destructive"
            ddClassName="font-mono font-bold text-destructive text-xs"
          />
        </StatGrid>
      </ReportMoneySummaryTile>
    </ReportMoneyCardsGrid>
  );
}
