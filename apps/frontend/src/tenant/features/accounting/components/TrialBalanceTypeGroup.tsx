import React from "react";
import { ACCOUNT_TYPE_META, type AccountType } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionLabel } from "@/components/app/SectionLabel";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";

import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { ReportMoneyCard } from "@/components/reports/ReportMoneyCard";
import { ReportMoneyCardsGrid } from "@/components/reports/ReportMoneyCardsGrid";
import { ReportMoneySummaryTile } from "@/components/reports/ReportMoneySummaryTile";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import { type AppTranslationKey } from "@mms/shared";

/** ReportMoneyCard tile (report) — not DirectoryCard. */
interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype?: string;
  totalDebit: number;
  totalCredit: number;
}

interface TrialBalanceTypeGroupProps {
  type: AccountType;
  accountTypeRows: TrialBalanceRow[];
  formatPositiveNumber: (amount: number) => string;
  viewMode?: WorkDirectoryViewMode;
}

export function TrialBalanceTypeGroup({
  type,
  accountTypeRows,
  formatPositiveNumber,
  viewMode: propViewMode,
}: TrialBalanceTypeGroupProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;

  if (accountTypeRows.length === 0) return null;

  const typeMeta = ACCOUNT_TYPE_META[type];

  const groupDebit = accountTypeRows.reduce(
    (sum, trialBalanceRow) => sum + trialBalanceRow.totalDebit,
    0,
  );
  const groupCredit = accountTypeRows.reduce(
    (sum, trialBalanceRow) => sum + trialBalanceRow.totalCredit,
    0,
  );
  const sortedRows = [...accountTypeRows].sort((firstRow, secondRow) =>
    firstRow.code.localeCompare(secondRow.code),
  );

  return (
    <section
      key={type}
      aria-label={t("accounting.coa.typeCaption", {
        type: t(`accounting.type.${type}` as AppTranslationKey),
      })}
    >
      <header
        className={`px-4 py-2 border-b border-border ${typeMeta?.color} flex min-w-0 items-center justify-between gap-2`}
      >
        <SectionLabel
          as="h3"
          weight="bold"
          tracking="wide"
          tone="inherit"
          className="min-w-0 truncate m-0"
        >
          {typeMeta?.icon} {t(`accounting.type.${type}` as AppTranslationKey)} —{" "}
          {t(`accounting.reports.views.${typeMeta?.group}` as AppTranslationKey)}
        </SectionLabel>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {t("accounting.tb.accountsCount", { count: accountTypeRows.length })}
        </span>
      </header>
      {viewMode === "cards" ? (
        <ReportMoneyCardsGrid>
          {sortedRows.map((trialBalanceRow) => (
            <ReportMoneyCard
              key={trialBalanceRow.id}
              title={
                <>
                  <p className="font-mono text-xs font-bold text-muted-foreground m-0">
                    {trialBalanceRow.code}
                  </p>
                  <h4 className="truncate text-sm font-medium text-foreground m-0 mt-0.5">
                    {trialBalanceRow.name}
                  </h4>
                </>
              }
              end={
                <div className="text-end">
                  <p className="font-mono text-xs font-semibold text-info m-0">
                    {formatPositiveNumber(trialBalanceRow.totalDebit)}
                  </p>
                  <p className="font-mono text-xs font-semibold text-success m-0">
                    {formatPositiveNumber(trialBalanceRow.totalCredit)}
                  </p>
                </div>
              }
            >
              {trialBalanceRow.subtype ? (
                <p className="text-xs text-muted-foreground m-0">{trialBalanceRow.subtype}</p>
              ) : null}
              <StatGrid>
                <StatRow
                  label={t("accounting.columns.journal.debit")}
                  value={formatPositiveNumber(trialBalanceRow.totalDebit)}
                  ddClassName="font-mono text-xs font-semibold text-info"
                />
                <StatRow
                  label={t("accounting.columns.journal.credit")}
                  value={formatPositiveNumber(trialBalanceRow.totalCredit)}
                  ddClassName="font-mono text-xs font-semibold text-success"
                />
              </StatGrid>
            </ReportMoneyCard>
          ))}
          <ReportMoneySummaryTile tone="soft" label={t("accounting.tb.subTotal")}>
            <StatGrid>
              <StatRow
                label={t("accounting.columns.journal.debit")}
                value={formatPositiveNumber(groupDebit)}
                ddClassName="font-mono font-bold text-info"
              />
              <StatRow
                label={t("accounting.columns.journal.credit")}
                value={formatPositiveNumber(groupCredit)}
                ddClassName="font-mono font-bold text-success"
              />
            </StatGrid>
          </ReportMoneySummaryTile>
        </ReportMoneyCardsGrid>
      ) : (
        <WorkBatchTable
          data={sortedRows}
          columns={[
            {
              id: "code",
              label: t("accounting.columns.account.code"),
              width: 80,
              cellClassName: "text-xs font-bold text-muted-foreground",
              variant: "number",
              render: (row) => row.code,
            },
            {
              id: "name",
              label: t("accounting.columns.account.name"),
              cellClassName: "font-medium text-foreground",
              render: (row) => row.name,
            },
            {
              id: "subtype",
              label: t("accounting.columns.account.subtype"),
              headerClassName: "hidden md:table-cell",
              cellClassName: "text-xs text-muted-foreground hidden md:table-cell",
              render: (row) => row.subtype || "—",
            },
            {
              id: "debit",
              label: t("accounting.columns.journal.debit"),
              variant: "currency",
              cellClassName: "table-amount-cell text-info",
              render: (row) => formatPositiveNumber(row.totalDebit),
            },
            {
              id: "credit",
              label: t("accounting.columns.journal.credit"),
              variant: "currency",
              cellClassName: "table-amount-cell text-success",
              render: (row) => formatPositiveNumber(row.totalCredit),
            },
          ]}
          caption={t("accounting.tb.typeCaption", {
            type: t(`accounting.type.${type}` as AppTranslationKey),
          })}
          className="border-t-0"
          rowClassName={() => "hover:bg-muted/20 transition-colors"}
          footerRow={{
            className: "border-t border-border bg-[--color-surface-table-footer]",
            cells: [
              {
                colSpan: 3,
                className: "table-footer-label",
                content: t("accounting.tb.subTotal"),
              },
              {
                className: "table-amount-cell text-xs text-info",
                align: "end",
                content: formatPositiveNumber(groupDebit),
              },
              {
                className: "table-amount-cell text-xs text-success",
                align: "end",
                content: formatPositiveNumber(groupCredit),
              },
            ],
          }}
        />
      )}
    </section>
  );
}
