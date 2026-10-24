import { StatGrid, StatRow } from "@/components/app/StatGrid";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import { ReportMoneyCard } from "@/components/reports/ReportMoneyCard";
import { ReportMoneySummaryTile } from "@/components/reports/ReportMoneySummaryTile";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface JournalEntryDetailLinesProps {
  entry: JournalEntry;
  accountTypeConfig: Record<string, StatusBadgeConfigItem>;
  getAccount: (id: string) => Account | undefined;
  totalDebit: number;
  totalCredit: number;
  formatCurrency: (value: number) => string;
  t: TranslationFunction;
  viewMode?: WorkDirectoryViewMode;
}

export function JournalEntryDetailLines({
  entry,
  accountTypeConfig,
  getAccount,
  totalDebit,
  totalCredit,
  formatCurrency,
  t,
  viewMode: propViewMode,
}: JournalEntryDetailLinesProps) {
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;

  return (
    <>
      {viewMode === "cards" ? (
        <div className="space-y-3 p-3">
          {entry.lines.map((line) => {
            const account = getAccount(line.account_id);
            return (
              <ReportMoneyCard
                key={line.id}
                header={
                  <div>
                    <p className="font-semibold text-foreground m-0">
                      {account?.name || t("accounting.journal.detail.unknownAccount")}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-muted-foreground">
                        {account?.code}
                      </span>
                      {account && (
                        <StatusBadge status={account.type} config={accountTypeConfig} size="sm" />
                      )}
                    </div>
                  </div>
                }
              >
                {line.description ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground m-0">
                      {t("accounting.journal.detail.note")}
                    </p>
                    <p className="text-xs text-muted-foreground m-0">{line.description}</p>
                  </div>
                ) : null}
                <StatGrid>
                  <StatRow
                    label={t("accounting.journal.detail.debit")}
                    value={line.debit > 0 ? formatCurrency(line.debit) : "—"}
                    ddClassName="font-mono text-xs font-semibold text-info"
                  />
                  <StatRow
                    label={t("accounting.journal.detail.credit")}
                    value={line.credit > 0 ? formatCurrency(line.credit) : "—"}
                    ddClassName="font-mono text-xs font-semibold text-success"
                  />
                </StatGrid>
              </ReportMoneyCard>
            );
          })}
          <ReportMoneySummaryTile label={t("accounting.journal.detail.totals")}>
            <StatGrid>
              <StatRow
                label={t("accounting.journal.detail.debit")}
                value={formatCurrency(totalDebit)}
                ddClassName="font-mono font-bold text-info"
              />
              <StatRow
                label={t("accounting.journal.detail.credit")}
                value={formatCurrency(totalCredit)}
                ddClassName="font-mono font-bold text-success"
              />
            </StatGrid>
          </ReportMoneySummaryTile>
        </div>
      ) : (
        <WorkBatchTable
          data={entry.lines}
          columns={[
            {
              id: "account",
              label: t("accounting.journal.detail.account"),
              cellClassName: "px-4 py-2.5",
              render: (line) => {
                const account = getAccount(line.account_id);
                return (
                  <>
                    <p className="font-semibold text-foreground m-0">
                      {account?.name || t("accounting.journal.detail.unknownAccount")}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-muted-foreground">
                        {account?.code}
                      </span>
                      {account && (
                        <StatusBadge status={account.type} config={accountTypeConfig} size="sm" />
                      )}
                    </div>
                  </>
                );
              },
            },
            {
              id: "note",
              label: t("accounting.journal.detail.note"),
              headerClassName: "hidden sm:table-cell",
              cellClassName: "px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell",
              render: (line) => line.description || "—",
            },
            {
              id: "debit",
              label: t("accounting.journal.detail.debit"),
              variant: "currency",
              cellClassName: "table-amount-cell text-info",
              render: (line) => (line.debit > 0 ? formatCurrency(line.debit) : "—"),
            },
            {
              id: "credit",
              label: t("accounting.journal.detail.credit"),
              variant: "currency",
              cellClassName: "table-amount-cell text-success",
              render: (line) => (line.credit > 0 ? formatCurrency(line.credit) : "—"),
            },
          ]}
          caption={t("accounting.journal.detail.account")}
          className="border-t-0"
          rowClassName={() => "hover:bg-muted/10"}
          footerRow={{
            className: "border-t-2 border-border bg-muted/30",
            cells: [
              {
                colSpan: 2,
                className: "table-footer-label",
                content: t("accounting.journal.detail.totals"),
              },
              {
                className: "table-amount-cell text-xs text-info",
                align: "end",
                content: formatCurrency(totalDebit),
              },
              {
                className: "table-amount-cell text-xs text-success",
                align: "end",
                content: formatCurrency(totalCredit),
              },
            ],
          }}
        />
      )}
    </>
  );
}
