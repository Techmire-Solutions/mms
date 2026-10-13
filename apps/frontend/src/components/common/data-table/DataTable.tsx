import React, { useId } from "react";
import { SearchX } from "lucide-react";
import {
  WorkBatchTable,
  WorkTaskToolbar,
  type WorkBatchTableColumn,
} from "@/components/common/work";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { toColumnCustomizer, toColumnResize } from "./columnLayoutAdapters";
import { DataTableCards } from "./DataTableCards";
import { DataTableFiltersMenu } from "./DataTableFiltersMenu";
import { useDataTableState } from "./useDataTableState";
import type { DataTableProps } from "./dataTableTypes";

/**
 * Standard data table: search across visible columns, facet filters, table/card toggle,
 * per-user column visibility/order/reset, and resizable columns. Pages configure
 * columns, filters, and actions; the chrome is shared.
 */
export function DataTable<TData extends { id: string | number }>({
  tableId,
  data,
  columns,
  filters,
  label,
  searchPlaceholder,
  isLoading = false,
  renderRowActions,
  renderCard,
  card,
  primaryAction,
  toolbarExtras,
  statusFilter,
  dateRange,
  trashToggle,
  filterChips,
  isSearching,
  emptyState,
  defaultViewMode,
  columnLayout,
  className,
  caption,
  ...tableProps
}: DataTableProps<TData>): React.JSX.Element {
  const { t } = useTranslation();
  const searchId = useId();
  const state = useDataTableState({
    tableId,
    data,
    columns,
    filters,
    defaultViewMode,
    columnLayout,
  });
  const { layout } = state;

  const tableColumns: WorkBatchTableColumn<TData>[] = state.visibleColumns.map((column) => ({
    id: column.id,
    label: column.label,
    width: column.width,
    headerClassName: column.headerClassName,
    cellClassName: column.cellClassName,
    render: column.render,
    noWrap: column.noWrap,
    truncate: column.truncate,
    align: column.align,
    variant: column.variant,
  }));

  const sourceEmpty = !isLoading && data.length === 0;
  const noMatches = (
    <EmptyState
      icon={SearchX}
      title={t("common.dataTable.noMatches")}
      compact
      variant="dashed"
      action={
        <Button type="button" variant="link" onClick={state.clearFilters} className="min-h-11">
          {t("common.clearFilters")}
        </Button>
      }
    />
  );

  return (
    <div
      className={cn(WORK_SURFACE, "p-4 space-y-4", className)}
      aria-busy={isLoading || undefined}
    >
      <WorkTaskToolbar
        regionLabel={label}
        shownCountLabel={t("common.dataTable.shownCount", { count: state.rows.length })}
        search={state.search}
        onSearchChange={state.setSearch}
        searchPlaceholder={searchPlaceholder ?? t("common.searchPlaceholder")}
        searchId={searchId}
        hasActiveFilters={state.hasActiveFilters}
        onClearFilters={state.clearFilters}
        clearFiltersLabel={t("common.clearFilters")}
        isSearching={isSearching}
        statusFilter={statusFilter}
        dateRange={dateRange}
        trashToggle={trashToggle}
        filterChips={filterChips}
        filterButton={
          filters?.length ? (
            <DataTableFiltersMenu
              filters={filters}
              selection={state.filterSelection}
              activeCount={state.activeFilterCount}
              onToggle={state.toggleFilterValue}
              onClear={state.clearFilters}
            />
          ) : undefined
        }
        viewModeToggle={{ viewMode: state.viewMode, onViewModeChange: state.setViewMode }}
        columnCustomizer={toColumnCustomizer(layout)}
        primaryAction={primaryAction}
      >
        {toolbarExtras}
      </WorkTaskToolbar>

      {sourceEmpty && emptyState ? (
        emptyState
      ) : !isLoading && state.rows.length === 0 ? (
        noMatches
      ) : state.viewMode === "cards" ? (
        <DataTableCards
          rows={state.rows}
          columns={state.visibleColumns}
          card={card}
          renderCard={renderCard}
          isColumnVisible={layout.isColumnVisible}
          renderRowActions={renderRowActions}
          onRowClick={tableProps.onRowClick}
        />
      ) : (
        <WorkBatchTable
          bordered={false}
          sort={
            tableProps.sort ?? {
              field: state.sortField,
              dir: state.sortDir,
              onSort: state.handleSort,
            }
          }
          {...tableProps}
          data={[...state.rows]}
          columns={tableColumns}
          caption={caption ?? label}
          isLoading={isLoading}
          renderRowActions={renderRowActions}
          actionsLabel={tableProps.actionsLabel ?? t("common.actions")}
          columnResize={toColumnResize(layout)}
        />
      )}
    </div>
  );
}
