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

function Table({
  className,
  containerClassName,
  stickyHeader,
  scrollRegionLabel,
  children,
  ref,
  ...props
}: TableProps) {
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
}

function TableHeader({ className, sticky, ref, ...props }: TableHeaderProps) {
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
}

function TableBody({ className, ref, ...props }: React.ComponentProps<"tbody">) {
  return <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, sticky, ref, ...props }: TableFooterProps) {
  return (
    <tfoot
      ref={ref}
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        sticky && "sticky bottom-0 z-10 bg-background/95 backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, isFocusable, tabIndex, ref, ...props }: TableRowProps) {
  return (
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
  );
}

function TableCaption({ className, ref, ...props }: TableCaptionProps) {
  return (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableCaption };
