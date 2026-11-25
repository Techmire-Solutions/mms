import React from "react";
import { cn, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mms/ui";
import type { FinancialLedgerRow } from "@mms/contracts";

export type { FinancialLedgerRow };

export interface FinancialLedgerTableProps {
  caption: string;
  rows: FinancialLedgerRow[];
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

/** Generic financial ledger preview table. */
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

  return (
    <Table className={className}>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          <TableHead className="table-header-cell px-3 py-2 text-start">{labels.account}</TableHead>
          <TableHead className="table-header-cell px-3 py-2 text-end">{labels.debit}</TableHead>
          <TableHead className="table-header-cell px-3 py-2 text-end">{labels.credit}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index} className={ROW_VARIANT_CLASS[row.variant ?? "neutral"]}>
            <TableCell className="px-3 py-2 font-semibold text-foreground">{row.account}</TableCell>
            <TableCell
              className={cn(
                "table-amount-cell px-3 py-2 text-end",
                row.variant === "debit" ? "text-info" : "text-muted-foreground",
              )}
            >
              {row.debit ?? PLACEHOLDER}
            </TableCell>
            <TableCell
              className={cn(
                "table-amount-cell px-3 py-2 text-end",
                row.variant === "credit" ? "text-success" : "text-muted-foreground",
              )}
            >
              {row.credit ?? PLACEHOLDER}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
