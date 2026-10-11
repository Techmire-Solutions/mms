import { useCallback, useMemo } from "react";
import { formatDate } from "@mms/shared";
import { TrendingUp, TrendingDown, ArrowUpDown, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { FLOW_TONE, SEMANTIC_BADGE } from "@/lib/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import type { CashbookRow } from "@/tenant/features/accounting/components/cashbookViewShared";
import type { JournalEntry } from "@/lib/data/accountingData";
import { PaymentVoucherPrintButton } from "@/tenant/features/accounting/components/PaymentVoucherPrintButton";

/** Optional payment-voucher action; the column exists only when this is given. */
export interface CashbookVoucherAction {
  canPrint: (entry: JournalEntry) => boolean;
  onPrint: (entry: JournalEntry) => void;
}

function flowIcon(flowType: CashbookRow["flowType"]) {
  if (flowType === "in")
    return <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" aria-hidden="true" />;
  if (flowType === "out")
    return <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" aria-hidden="true" />;
  if (flowType === "unclassified")
    return <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" aria-hidden="true" />;
  return <ArrowUpDown className="w-3.5 h-3.5 text-info shrink-0" aria-hidden="true" />;
}

/** Cashbook table/card column definitions plus the flow icon + badge renderers they share. */
export function useCashbookColumns(
  formatCurrency: (amount: number) => string,
  voucher?: CashbookVoucherAction,
) {
  const { t } = useTranslation();

  const flowBadge = useCallback(
    (row: CashbookRow) => (
      <StatusBadge
        status={row.flowType}
        size="sm"
        config={{
          in: { label: row.flowLabel, cls: FLOW_TONE.in.badge },
          out: { label: row.flowLabel, cls: FLOW_TONE.out.badge },
          transfer: { label: row.flowLabel, cls: SEMANTIC_BADGE.infoStrong },
          // A posted entry with no cash/bank line cannot be reported as money in
          // or out; the row says "Unclassified" instead of showing "—" in both
          // money columns with no explanation.
          unclassified: {
            label: row.flowLabel || t("accounting.cashbook.unclassified"),
            cls: SEMANTIC_BADGE.warningStrong,
          },
        }}
      />
    ),
    [t],
  );

  const columns = useMemo<WorkBatchTableColumn<CashbookRow>[]>(
    () => [
      {
        id: "date",
        label: t("accounting.columns.journal.date"),
        noWrap: true,
        cellClassName: "text-xs text-muted-foreground",
        render: (row) => formatDate(row.date),
      },
      {
        id: "type",
        label: t("accounting.columns.journal.type"),
        noWrap: true,
        render: (row) => (
          <div className="inline-flex items-center gap-1.5">
            {flowIcon(row.flowType)}
            {flowBadge(row)}
          </div>
        ),
      },
      {
        id: "description",
        label: t("accounting.columns.journal.description"),
        truncate: true,
        cellClassName: "text-foreground max-w-cell-trunc",
        render: (row) => (
          <>
            <p className="font-medium m-0">{row.description}</p>
            <p className="text-xs text-muted-foreground font-mono m-0">{row.ref}</p>
          </>
        ),
      },
      {
        id: "moneyIn",
        label: t("accounting.cashbook.moneyIn"),
        headerClassName: "text-end text-success",
        noWrap: true,
        cellClassName: "text-end",
        render: (row) =>
          row.flowType === "in" ? (
            <span className="font-mono font-bold text-success">
              {formatCurrency(row.flowAmount)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "moneyOut",
        label: t("accounting.cashbook.moneyOut"),
        headerClassName: "text-end text-destructive",
        noWrap: true,
        cellClassName: "text-end",
        render: (row) =>
          row.flowType === "out" ? (
            <span className="font-mono font-bold text-destructive">
              {formatCurrency(row.flowAmount)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      ...(voucher
        ? [
            {
              id: "voucher",
              label: t("accounting.journal.voucher.title"),
              headerClassName: "text-end",
              noWrap: true,
              cellClassName: "text-end",
              render: (row: CashbookRow) =>
                voucher.canPrint(row) ? (
                  <PaymentVoucherPrintButton entry={row} onPrint={voucher.onPrint} />
                ) : null,
            },
          ]
        : []),
    ],
    [t, formatCurrency, flowBadge, voucher],
  );

  return { columns, flowBadge, flowIcon };
}
