import React from "react";
import { Search, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";
import { Pagination } from "./Pagination";
import { Input } from "../input/Input";
import { useUiConfig } from "../theme/UiConfigContext";
import { cn } from "../utils";

export interface DataTableColumn<TData> {
  id: string;
  header: React.ReactNode;
  accessorKey?: keyof TData;
  cell?: (row: TData) => React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}

export interface DataTableProps<TData extends { id: string | number }> {
  data: TData[];
  columns: DataTableColumn<TData>[];
  isLoading?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  toolbarExtras?: React.ReactNode;
  primaryAction?: React.ReactNode;
  emptyState?: React.ReactNode;
  renderRowActions?: (row: TData) => React.ReactNode;
  onRowClick?: (row: TData) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize?: number;
    totalItems?: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
  className?: string;
}

/**
 * Pure presentational DataTable component decoupled from app-specific state.
 * Supports searching, pagination, custom row renderers, and responsive layouts.
 */
export function DataTable<TData extends { id: string | number }>({
  data,
  columns,
  isLoading = false,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  toolbarExtras,
  primaryAction,
  emptyState,
  renderRowActions,
  onRowClick,
  pagination,
  className,
}: DataTableProps<TData>): React.JSX.Element {
  const { labels } = useUiConfig();

  const showToolbar = onSearchChange !== undefined || toolbarExtras || primaryAction;

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
      {/* Table Toolbar */}
      {showToolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            {onSearchChange && (
              <div className="w-full sm:max-w-xs">
                <Input
                  type="search"
                  value={searchQuery ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder ?? labels.searchPlaceholder}
                  leftIcon={<Search className="size-4" />}
                />
              </div>
            )}
            {toolbarExtras}
          </div>
          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        </div>
      )}

      {/* Main Table Shell */}
      <div className="relative rounded-lg border border-border bg-card shadow-xs">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-2xs">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    col.align === "center" && "text-center",
                    col.align === "end" && "text-end",
                    col.className,
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
              {renderRowActions && <TableHead className="w-16 text-end" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(onRowClick && "cursor-pointer hover:bg-muted/40")}
                >
                  {columns.map((col) => {
                    const value = col.accessorKey ? row[col.accessorKey] : undefined;
                    return (
                      <TableCell
                        key={col.id}
                        className={cn(
                          col.align === "center" && "text-center",
                          col.align === "end" && "text-end",
                          col.className,
                        )}
                      >
                        {col.cell ? col.cell(row) : (value as React.ReactNode)}
                      </TableCell>
                    );
                  })}
                  {renderRowActions && (
                    <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                      {renderRowActions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (renderRowActions ? 1 : 0)}
                  className="h-32 text-center"
                >
                  {emptyState ?? (
                    <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                      <p className="text-sm font-medium">{labels.emptyTitle}</p>
                      <p className="text-xs">{labels.emptyDescription}</p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        {pagination && pagination.totalPages > 0 && (
          <div className="border-t border-border px-4">
            <Pagination {...pagination} />
          </div>
        )}
      </div>
    </div>
  );
}
