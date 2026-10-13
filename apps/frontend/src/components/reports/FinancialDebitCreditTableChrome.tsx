import React, { type ReactNode } from "react";
import { TableFooter, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Shared muted header row for report / matrix / statement tables. */
export function MutedTableHeaderRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <TableRow className={cn("border-b border-border bg-muted/30 hover:bg-muted/30", className)}>
      {children}
    </TableRow>
  );
}

/** @deprecated Prefer {@link MutedTableHeaderRow} — alias retained for debit/credit call sites. */
export const FinancialDebitCreditHeaderRow = MutedTableHeaderRow;

/** Shared totals footer bar for debit/credit journal & ledger tables. */
export function FinancialDebitCreditFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <TableFooter className={cn("border-t-2 border-border bg-muted/30", className)}>
      {children}
    </TableFooter>
  );
}

/** Totals footer row with transparent hover (journal/GL pattern). */
export function FinancialDebitCreditFooterRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return <TableRow className={cn("hover:bg-transparent", className)}>{children}</TableRow>;
}
