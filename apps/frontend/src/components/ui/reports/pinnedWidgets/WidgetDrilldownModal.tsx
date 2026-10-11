import React from "react";
import { EyeOff } from "lucide-react";
import { resolveWidgetTitle } from "@/lib/dashboardWidgets";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ListPagination } from "@/components/ui/ListPagination";
import { SearchBar } from "@/components/ui/SearchBar";
import { Badge } from "@/components/ui/badge";
import { useWidgetDrilldownModal } from "@/components/ui/reports/pinnedWidgets/useWidgetDrilldownModal";
import { WidgetDrilldownModalRecords } from "@/components/ui/reports/pinnedWidgets/WidgetDrilldownModalRecords";

/**
 * Focused overlay drilldown modal for micro-interactions.
 * Displays details of records matching the single metric.
 */
export function WidgetDrilldownModal({
  widget,
  onClose
}: {
  widget: CustomWidget;
  onClose: () => void;
}): React.JSX.Element {
  const {
    t,
    searchQuery: search,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    paginatedItems,
    filteredItems: filteredRecords,
    totalPages,
    studentNameMap,
    handleToggleStatus,
    handleDeleteDist,
  } = useWidgetDrilldownModal(widget);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t("reports.widgets.records", { title: resolveWidgetTitle(widget, t) })}
      subtitle={t("reports.widgets.drilldownTitle")}
      panelClassName="max-h-drawer flex flex-col"
      headerExtra={
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <SearchBar
            value={search}
            onChange={handleSearchChange}
            placeholder={t("reports.widgets.searchRecords")}
            className="min-w-0 flex-1 max-w-sm"
          />
          <Badge pill tone="muted" className="px-2 py-1.5 font-bold shrink-0">
            {t("reports.widgets.foundCount", { count: filteredRecords.length })}
          </Badge>
        </div>
      }
      footer={
        totalPages > 1 ? (
          <div className="flex w-full items-center justify-end gap-4 text-xs">
            <span className="text-xs font-bold text-muted-foreground">
              {t("reports.widgets.foundCount", { count: filteredRecords.length })}
            </span>
            <ListPagination
              variant="compact"
              page={currentPage}
              total={totalPages}
              limit={1}
              onPageChange={setCurrentPage}
            />
          </div>
        ) : undefined
      }
    >
      {filteredRecords.length === 0 ? (
        <EmptyState
          title={t("reports.widgets.noRecords")}
          icon={EyeOff}
          compact
        />
      ) : (
        <WidgetDrilldownModalRecords
          t={t}
          widget={widget}
          paginatedItems={paginatedItems}
          studentNameMap={studentNameMap}
          handleToggleStatus={handleToggleStatus}
          handleDeleteDist={handleDeleteDist}
        />
      )}
    </Modal>
  );
}
