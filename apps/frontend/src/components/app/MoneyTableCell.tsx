import type { JSX } from "react";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Semantic colour variants for monetary table cells.
 * - `debit`   : credit-side amounts (info blue, positive movement)
 * - `credit`  : debit-side amounts  (success green, positive movement)
 * - `negative`: destructive red     (overdue, negative balance)
 * - `neutral` : default foreground  (total rows, balance fields)
 */
export type MoneyVariant = "debit" | "credit" | "negative" | "neutral";

const VARIANT_CLASS: Record<MoneyVariant, string> = {
  debit: "text-info",
  credit: "text-success",
  negative: "text-destructive",
  neutral: "text-foreground",
};

export interface MoneyTableCellProps {
  /** Formatted monetary string, e.g. `"1,234.56"` or `"—"`. */
  value: string;
  variant?: MoneyVariant;
  /** Whether to use footer-weight styling (`table-footer-label` sizing). Default false. */
  isFooter?: boolean;
  /** Prevents text wrapping. Defaults to true for numeric currency. */
  noWrap?: boolean;
  className?: string;
}

/**
 * Standardised monetary `<TableCell>` for WorkBatchTable and plain Table contexts.
 *
 * Uses the `table-amount-cell` CSS utility from `index.css` for consistent
 * end-alignment, mono font, and bold weight. Pass `variant` to get semantic
 * colour coding that matches the design token contract.
 *
 * @example
 * // Debit column
 * <MoneyTableCell value={formatCurrency(line.debit)} variant="debit" />
 * // Footer total (success)
 * <MoneyTableCell value={formatCurrency(total)} variant="credit" isFooter />
 */
export function MoneyTableCell({
  value,
  variant = "neutral",
  isFooter = false,
  noWrap = true,
  className,
}: MoneyTableCellProps): JSX.Element {
  return (
    <TableCell
      variant="currency"
      noWrap={noWrap}
      className={cn("table-amount-cell", VARIANT_CLASS[variant], isFooter && "text-xs", className)}
    >
      {value}
    </TableCell>
  );
}
