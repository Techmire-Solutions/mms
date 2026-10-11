import React from "react";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionLabel } from "@/components/ui/SectionLabel";

import { ReportMoneyCard } from "@/components/ui/reports/ReportMoneyCard";
import { ReportMoneyCardsGrid } from "@/components/ui/reports/ReportMoneyCardsGrid";
import { ReportMoneySummaryTile } from "@/components/ui/reports/ReportMoneySummaryTile";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";

/** ReportMoneyCard tile (report) — not DirectoryCard. */
export interface ReportRow {
  id: string;
  name: string;
  code: string;
  type: string;
  subtype?: string;
  totalDebit: number;
  totalCredit: number;
}

interface ReportSectionProps {
  title: string;
  rows: ReportRow[];
  totalLabel: string;
  total: number;
  debitNormal: boolean;
  color?: string;
  viewMode?: WorkDirectoryViewMode;
}

export function ReportSection({
  title,
  rows,
  totalLabel,
  total,
  debitNormal,
  color,
  viewMode: propViewMode,
}: ReportSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;
  const maxAmount = Math.max(
    ...rows.map((reportRow) => {
      const rowAmount = debitNormal
        ? reportRow.totalDebit - reportRow.totalCredit
        : reportRow.totalCredit - reportRow.totalDebit;
      return Math.abs(rowAmount);
    }),
    1,
  );

  return (
    <section aria-label={title}>
      <header className={`px-4 py-2.5 border-b border-border ${color || "bg-muted/60"}`}>
        <SectionLabel as="h3" weight="bold" tracking="wide" tone="foreground" className="m-0">
          {title}
        </SectionLabel>
      </header>
      {viewMode === "cards" ? (
        <ReportMoneyCardsGrid>
          {rows.map((reportRow) => {
            const rowAmount = debitNormal
              ? reportRow.totalDebit - reportRow.totalCredit
              : reportRow.totalCredit - reportRow.totalDebit;
            const percentage = (Math.abs(rowAmount) / maxAmount) * 100;
            return (
              <ReportMoneyCard
                key={reportRow.id}
                title={
                  <h4 className="truncate text-sm font-medium text-foreground">{reportRow.name}</h4>
                }
                meta={
                  <p className="text-xs text-muted-foreground font-mono m-0">
                    {reportRow.code} · {reportRow.subtype || reportRow.type}
                  </p>
                }
                end={
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(Math.abs(rowAmount))}
                  </span>
                }
              >
                <ProgressBar
                  value={percentage}
                  size="sm"
                  fillClassName="bg-primary/40"
                  aria-hidden="true"
                />
              </ReportMoneyCard>
            );
          })}
          <ReportMoneySummaryTile label={totalLabel} value={formatCurrency(total)} />
        </ReportMoneyCardsGrid>
      ) : (
        <WorkBatchTable
          data={rows}
          columns={[
            {
              id: "report",
              label: "Report",
              render: (reportRow) => {
                const rowAmount = debitNormal
                  ? reportRow.totalDebit - reportRow.totalCredit
                  : reportRow.totalCredit - reportRow.totalDebit;
                const percentage = (Math.abs(rowAmount) / maxAmount) * 100;
                return (
                  <div className="py-1 w-full">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">{reportRow.name}</span>
                      <span className="font-mono font-semibold text-foreground ms-2">
                        {formatCurrency(Math.abs(rowAmount))}
                      </span>
                    </div>
                    <ProgressBar
                      value={percentage}
                      size="sm"
                      fillClassName="bg-primary/40"
                      aria-hidden="true"
                    />
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono m-0">
                      {reportRow.code} · {reportRow.subtype || reportRow.type}
                    </p>
                  </div>
                );
              },
            },
          ]}
          caption={t("accounting.reports.sectionDataCaption", { title })}
          className="[&_thead]:hidden border-t-0"
          rowClassName={() => "hover:bg-muted/10"}
          footerRow={{
            cells: [
              {
                className: "flex items-center justify-between",
                content: (
                  <>
                    <span className="font-bold text-foreground">{totalLabel}</span>
                    <span className="font-mono font-bold text-foreground text-base">
                      {formatCurrency(total)}
                    </span>
                  </>
                ),
              },
            ],
          }}
        />
      )}
    </section>
  );
}
