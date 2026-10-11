import React from "react";
import { Badge } from "@/components/ui/badge";
import { StatGrid, StatRow } from "@/components/ui/StatGrid";
import { ReportMoneyCard } from "@/components/ui/reports/ReportMoneyCard";
import { ReportMoneyCardsGrid } from "@/components/ui/reports/ReportMoneyCardsGrid";
import { ReportMoneySummaryTile } from "@/components/ui/reports/ReportMoneySummaryTile";
import { useTranslation } from "@/hooks/useTranslation";
import { AlertCircle } from "lucide-react";
import type { WakalaSummaryEntry } from "./ObligationsWakalaSummarySection";

/** ReportMoneyCard tile (report) — not DirectoryCard. */
export interface ObligationsWakalaSummaryCardsViewProps {
  wakalaSummary: WakalaSummaryEntry[];
  totalAmount: number;
  formatCurrency: (amount: number | string | null | undefined) => string;
}

export function ObligationsWakalaSummaryCardsView({
  wakalaSummary,
  totalAmount,
  formatCurrency,
}: ObligationsWakalaSummaryCardsViewProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ReportMoneyCardsGrid surface>
      {wakalaSummary.map((wakalaSummaryItem) => (
        <ReportMoneyCard
          key={wakalaSummaryItem.key}
          header={
            <div>
              <h4 className="text-sm font-semibold text-foreground m-0">
                {wakalaSummaryItem.repName}
              </h4>
              {!wakalaSummaryItem.hasWakala && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-warning font-bold mt-0.5"
                  aria-label={t("obligations.summary.wakala.noConfigAria")}
                >
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />{" "}
                  {t("obligations.summary.wakala.noConfig")}
                </span>
              )}
            </div>
          }
        >
          <StatGrid>
            <StatRow
              label={t("obligations.summary.wakala.colMujtahid")}
              value={wakalaSummaryItem.mujtahidName}
              ddClassName="text-xs text-muted-foreground"
            />
            <StatRow
              label={t("obligations.summary.wakala.colObligation")}
              value={
                <Badge pill tone="primary" className="px-2 font-bold">
                  {wakalaSummaryItem.obligationType}
                </Badge>
              }
            />
            <StatRow
              label={t("obligations.summary.wakala.colCollections")}
              value={wakalaSummaryItem.count}
              ddClassName="text-sm font-semibold"
            />
            <StatRow
              label={t("obligations.summary.wakala.colTotalAmountShort")}
              value={formatCurrency(wakalaSummaryItem.total)}
              ddClassName="font-mono font-bold text-success text-sm"
            />
          </StatGrid>
          {wakalaSummaryItem.distributions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                {t("obligations.summary.wakala.colDistributions")}
              </p>
              <div className="flex flex-wrap gap-1">
                {wakalaSummaryItem.distributions.map((distribution) => (
                  <span
                    key={distribution.id}
                    className={`text-xs font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${distribution.type === "Liability" ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-success/10 border-success/30 text-success"}`}
                  >
                    {distribution.name} {distribution.percentage}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </ReportMoneyCard>
      ))}
      <ReportMoneySummaryTile
        label={t("obligations.summary.wakala.configCount", { count: wakalaSummary.length })}
      >
        <p className="font-mono font-bold text-success text-sm m-0">
          {formatCurrency(totalAmount)}
        </p>
      </ReportMoneySummaryTile>
    </ReportMoneyCardsGrid>
  );
}
