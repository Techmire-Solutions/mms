import * as React from "react";
import { cn } from "../utils";

const TableContext = React.createContext<{ stickyHeader?: boolean }>({});

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
  stickyHeader?: boolean;
  scrollRegionLabel?: string;
  ref?: React.Ref<HTMLTableElement>;
}

export function Table({
  className,
  containerClassName,
  stickyHeader,
  scrollRegionLabel,
  children,
  ref,
  ...props
}: TableProps) {
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
Table.displayName = "Table";

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
  ref?: React.Ref<HTMLTableSectionElement>;
}

export function TableHeader({ className, sticky, ref, ...props }: TableHeaderProps) {
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
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
  ref?: React.Ref<HTMLTableSectionElement>;
}

export function TableFooter({ className, sticky, ref, ...props }: TableFooterProps) {
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
TableFooter.displayName = "TableFooter";

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isFocusable?: boolean;
  ref?: React.Ref<HTMLTableRowElement>;
}

export function TableRow({ className, isFocusable, tabIndex, ref, ...props }: TableRowProps) {
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
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-4 text-start align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pe-0",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pe-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";
