import React from "react";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import { cn } from "@/lib/utils";
import type { FinancialLedgerRow } from "@mms/shared";

export type { FinancialLedgerRow };

export interface FinancialLedgerTableProps {
  /** Accessible <caption> text (screen-reader only). */
  caption: string;
  rows: FinancialLedgerRow[];
  /** Column header labels. Defaults to account / Debit / Credit. */
  columnLabels?: {
    account?: string;
    debit?: string;
    credit?: string;
  };
  className?: string;
}

const PLACEHOLDER = "—";

const ROW_VARIANT_CLASS: Record<NonNullable<FinancialLedgerRow["variant"]>, string> = {
  debit: "row-debit border-b border-border",
  credit: "row-credit border-0",
  neutral: "border-b border-border",
};

/**
 * Generic financial ledger preview table.
 *
 * Renders a bordered debit/credit table with semantic row colour-coding,
 * using the CSS utilities defined in index.css (table-header-cell,
 * table-amount-cell, row-debit, row-credit). Consumers pass plain data;
 * no styling decisions are made at the call-site.
 *
 * @example
 * <FinancialLedgerTable
 *   caption="Transaction posting preview"
 *   rows={[
 *     { account: 'Cash',    debit:  '1,000.00', variant: 'debit'  },
 *     { account: 'Revenue', credit: '1,000.00', variant: 'credit' },
 *   ]}
 * />
 */
export function FinancialLedgerTable({
  caption,
  rows,
  columnLabels,
  className,
}: FinancialLedgerTableProps): React.JSX.Element {
  const labels = {
    account: columnLabels?.account ?? "Account",
    debit: columnLabels?.debit ?? "Debit",
    credit: columnLabels?.credit ?? "Credit",
  };

  const dataWithIds = rows.map((r, i) => ({ ...r, id: String(i) }));

  return (
    <WorkBatchTable
      caption={caption}
      data={dataWithIds}
      className={className}
      bordered={true}
      rowClassName={(row) => ROW_VARIANT_CLASS[row.variant ?? "neutral"]}
      columns={[
        {
          id: "account",
          label: labels.account,
          cellClassName: "px-3 py-2 font-semibold text-foreground",
          render: (row) => row.account,
        },
        {
          id: "debit",
          label: labels.debit,
          variant: "currency",
          cellClassName: (row) =>
            cn(
              "table-amount-cell",
              row.variant === "debit" ? "text-info" : "text-muted-foreground",
            ),
          render: (row) => row.debit ?? PLACEHOLDER,
        },
        {
          id: "credit",
          label: labels.credit,
          variant: "currency",
          cellClassName: (row) =>
            cn(
              "table-amount-cell",
              row.variant === "credit" ? "text-success" : "text-muted-foreground",
            ),
          render: (row) => row.credit ?? PLACEHOLDER,
        },
      ]}
    />
  );
}
