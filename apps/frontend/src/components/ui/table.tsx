import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  TableCaptionProps,
  TableFooterProps,
  TableHeaderProps,
  TableProps,
  TableRowProps,
} from "./table/tableTypes";

export * from "./table/tableTypes";
export * from "./table/tableUtils";
export * from "./table/TableHead";
export * from "./table/TableCell";
export * from "./table/TableSkeleton";
export * from "./table/TableEmpty";
export * from "./table/useTableSort";

const TableContext = React.createContext<{ stickyHeader?: boolean }>({});

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, stickyHeader, scrollRegionLabel, children, ...props }, ref) => {
    // Stable context identity — avoids re-rendering every header/cell consumer on
    // each parent render (the `value={{ stickyHeader }}` literal is banned by
    // `mms-react/no-unmemoized-context-value`).
    const tableContextValue = React.useMemo(() => ({ stickyHeader }), [stickyHeader]);

    return (
      <TableContext.Provider value={tableContextValue}>
        <div
          role={scrollRegionLabel ? "region" : undefined}
          aria-label={scrollRegionLabel}
          tabIndex={scrollRegionLabel ? 0 : undefined}
          className={cn("relative w-full max-w-full overflow-x-auto", containerClassName)}
        >
          <table
            ref={ref}
            role="table"
            className={cn("w-full caption-bottom text-sm", className)}
            {...props}
          >
            {children}
          </table>
        </div>
      </TableContext.Provider>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, sticky, ...props }, ref) => {
    const tableCtx = React.useContext(TableContext);
    const isSticky = sticky ?? tableCtx.stickyHeader;
    return (
      <thead
        ref={ref}
        className={cn(
          "[&_tr]:border-b",
          isSticky && "sticky top-0 z-10 bg-background/95 backdrop-blur-xs shadow-2xs",
          className,
        )}
        {...props}
      />
    );
  },
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, sticky, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        sticky && "sticky bottom-0 z-10 bg-background/95 backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, isFocusable, tabIndex, ...props }, ref) => (
    <tr
      ref={ref}
      role="row"
      tabIndex={isFocusable ? (tabIndex ?? 0) : tabIndex}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        isFocusable &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableCaption };
