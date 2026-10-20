import React from "react";
import { formatDate } from "@mms/shared";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { ReportMoneyCard } from "@/components/reports/ReportMoneyCard";
import { ReportMoneyCardsGrid } from "@/components/reports/ReportMoneyCardsGrid";
import { ReportMoneySummaryTile } from "@/components/reports/ReportMoneySummaryTile";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { GeneralLedgerLineWithRunning } from "../hooks/useGeneralLedger";

/** ReportMoneyCard tile (report) — not DirectoryCard. */
export interface GeneralLedgerCardsViewProps {
  linesWithRunning: GeneralLedgerLineWithRunning[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
  formatCurrency: (amount: number) => string;
  t: TranslationFunction;
}

export function GeneralLedgerCardsView({
  linesWithRunning,
  totalDebit,
  totalCredit,
  balance,
  formatCurrency,
  t,
}: GeneralLedgerCardsViewProps): React.JSX.Element {
  return (
    <div className={WORK_SURFACE}>
      <ReportMoneyCardsGrid
        className="p-3"
        items={linesWithRunning}
        renderItem={(line, index) => (
          <ReportMoneyCard
            key={`${line.ref}-${index}`}
            title={
              <>
                <p className="text-xs text-muted-foreground m-0">{formatDate(line.date)}</p>
                <p className="truncate font-mono text-xs font-bold text-primary m-0 mt-0.5">
                  {line.ref}
                </p>
              </>
            }
            end={
              <div className="text-end font-mono text-xs font-semibold">
                <span className={line.running >= 0 ? "text-foreground" : "text-destructive"}>
                  {formatCurrency(Math.abs(line.running))}
                </span>
                <span className="text-xs text-muted-foreground ms-1">
                  {line.running >= 0 ? t("accounting.ledger.dr") : t("accounting.ledger.cr")}
                </span>
              </div>
            }
          >
            <p className="text-sm text-foreground m-0">{line.description}</p>
            {line.lineDesc ? (
              <p className="text-xs text-muted-foreground m-0">{line.lineDesc}</p>
            ) : null}
            <StatGrid>
              <StatRow
                label={t("accounting.ledger.columns.debit")}
                value={line.debit > 0 ? formatCurrency(line.debit) : "—"}
                ddClassName="font-mono text-xs font-semibold text-info"
              />
              <StatRow
                label={t("accounting.ledger.columns.credit")}
                value={line.credit > 0 ? formatCurrency(line.credit) : "—"}
                ddClassName="font-mono text-xs font-semibold text-success"
              />
            </StatGrid>
          </ReportMoneyCard>
        )}
      />
      <div className="px-3 pb-3">
        <ReportMoneySummaryTile label={t("accounting.ledger.closingBalance")}>
          <StatGrid columns="sm3">
            <StatRow
              label={t("accounting.ledger.columns.debit")}
              value={formatCurrency(totalDebit)}
              ddClassName="font-mono font-bold text-info"
            />
            <StatRow
              label={t("accounting.ledger.columns.credit")}
              value={formatCurrency(totalCredit)}
              ddClassName="font-mono font-bold text-success"
            />
            <StatRow
              label={t("accounting.ledger.columns.balance")}
              value={`${formatCurrency(Math.abs(balance))} ${balance >= 0 ? t("accounting.ledger.dr") : t("accounting.ledger.cr")}`}
              ddClassName="font-mono font-bold"
            />
          </StatGrid>
        </ReportMoneySummaryTile>
      </div>
    </div>
  );
}
