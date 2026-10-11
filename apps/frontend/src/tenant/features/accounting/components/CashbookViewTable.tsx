import { formatDate } from "@mms/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatGrid, StatRow } from "@/components/ui/StatGrid";
import { ReportMoneyCard } from "@/components/ui/reports/ReportMoneyCard";
import { ReportMoneyCardsGrid } from "@/components/ui/reports/ReportMoneyCardsGrid";
import { ReportMoneySummaryTile } from "@/components/ui/reports/ReportMoneySummaryTile";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import {
  resolveVisibleColumns,
  toColumnResize,
  type DataTableColumnLayout,
} from "@/components/common/data-table";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import {
  buildCashbookFooterCells,
  type CashbookRow,
} from "@/tenant/features/accounting/components/cashbookViewShared";
import type { WorkBatchTableFooterRow } from "@/components/common/work/workBatchTableTypes";
import {
  useCashbookColumns,
  type CashbookVoucherAction,
} from "@/tenant/features/accounting/components/useCashbookColumns";
import { PaymentVoucherPrintButton } from "@/tenant/features/accounting/components/PaymentVoucherPrintButton";

/** ReportMoneyCard tile (report) — not DirectoryCard. */
interface CashbookViewTableProps {
  rows: CashbookRow[];
  totalIn: number;
  totalOut: number;
  formatCurrency: (amount: number) => string;
  viewMode?: WorkDirectoryViewMode;
  /** Page-owned column visibility/order/width (`useModuleColumnLayout`). */
  columnLayout?: DataTableColumnLayout;
  voucher?: CashbookVoucherAction;
}

export function CashbookViewTable({
  rows,
  totalIn,
  totalOut,
  formatCurrency,
  viewMode: propViewMode,
  columnLayout,
  voucher,
}: CashbookViewTableProps) {
  const { t } = useTranslation();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;
  const { columns, flowBadge, flowIcon } = useCashbookColumns(formatCurrency, voucher);

  if (rows.length === 0) {
    return <EmptyState variant="dashed" title={t("accounting.cashbook.noTransactions")} compact />;
  }

  if (viewMode === "cards") {
    return (
      <ReportMoneyCardsGrid surface>
        {rows.map((row) => (
          <ReportMoneyCard
            key={row.id}
            title={
              <>
                <p className="text-xs text-muted-foreground m-0">{formatDate(row.date)}</p>
                <h4 className="font-medium text-sm text-foreground m-0 mt-0.5">
                  {row.description}
                </h4>
                <p className="text-xs text-muted-foreground font-mono m-0">{row.ref}</p>
              </>
            }
            end={
              <div className="inline-flex items-center gap-1.5">
                {flowIcon(row.flowType)}
                {flowBadge(row)}
                {voucher?.canPrint(row) && (
                  <PaymentVoucherPrintButton entry={row} onPrint={voucher.onPrint} />
                )}
              </div>
            }
          >
            <StatGrid>
              <StatRow
                label={t("accounting.cashbook.moneyIn")}
                value={
                  row.flowType === "in" ? (
                    formatCurrency(row.flowAmount)
                  ) : (
                    <span className="text-muted-foreground font-normal">—</span>
                  )
                }
                dtClassName="text-success"
                ddClassName="font-mono font-bold text-success"
              />
              <StatRow
                label={t("accounting.cashbook.moneyOut")}
                value={
                  row.flowType === "out" ? (
                    formatCurrency(row.flowAmount)
                  ) : (
                    <span className="text-muted-foreground font-normal">—</span>
                  )
                }
                dtClassName="text-destructive"
                ddClassName="font-mono font-bold text-destructive"
              />
            </StatGrid>
          </ReportMoneyCard>
        ))}
        <ReportMoneySummaryTile
          label={t("accounting.cashbook.transactionCount", { count: rows.length })}
        >
          <StatGrid>
            <StatRow
              label={t("accounting.cashbook.moneyIn")}
              value={formatCurrency(totalIn)}
              dtClassName="text-success"
              ddClassName="font-mono font-bold text-success text-xs"
            />
            <StatRow
              label={t("accounting.cashbook.moneyOut")}
              value={formatCurrency(totalOut)}
              dtClassName="text-destructive"
              ddClassName="font-mono font-bold text-destructive text-xs"
            />
          </StatGrid>
        </ReportMoneySummaryTile>
      </ReportMoneyCardsGrid>
    );
  }

  const visibleColumns = columnLayout
    ? resolveVisibleColumns(columns, columnLayout.columnRegistry)
    : columns;
  const footerRow: WorkBatchTableFooterRow = {
    cells: buildCashbookFooterCells(visibleColumns.map((column) => column.id)).map(
      (cell, index) => ({
        colSpan: cell.span,
        className:
          cell.kind === "label" || cell.kind === "blank"
            ? "table-footer-label"
            : `table-amount-cell text-xs ${cell.kind === "moneyIn" ? "text-success" : "text-destructive"}`,
        content:
          cell.kind === "label"
            ? t("accounting.cashbook.transactionCount", { count: rows.length })
            : cell.kind === "blank"
              ? null
              : formatCurrency(cell.kind === "moneyIn" ? totalIn : totalOut),
      }),
    ),
  };

  return (
    <WorkBatchTable
      data={rows}
      columns={visibleColumns}
      caption={t("accounting.cashbook.tableCaption")}
      columnResize={toColumnResize(columnLayout)}
      footerRow={footerRow}
    />
  );
}
