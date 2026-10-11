import React from "react";
import { TableFooter, TableRow, TableCell } from "@/components/ui/table";
import type { WorkBatchTableFooterRow } from "./workBatchTableTypes";
import { cn } from "@/lib/utils";

export interface WorkBatchTableFooterProps {
  footerRow: WorkBatchTableFooterRow;
}

/**
 * Standardized semantic footer row for WorkBatchTable.
 * Renders structured cells with alignment, colSpan, and design token styling.
 */
export function WorkBatchTableFooter({ footerRow }: WorkBatchTableFooterProps): React.JSX.Element {
  return (
    <TableFooter
      className={cn(
        "border-t border-border bg-[--color-surface-table-footer]",
        footerRow.className,
      )}
    >
      <TableRow className="hover:bg-transparent">
        {footerRow.cells.map((cell, idx) => (
          <TableCell
            key={idx}
            colSpan={cell.colSpan}
            className={cn(
              cell.align === "end" && "text-end",
              cell.align === "center" && "text-center",
              cell.className,
            )}
          >
            {cell.content}
          </TableCell>
        ))}
      </TableRow>
    </TableFooter>
  );
}
