/**
 * @file WorkshopsDirectory.tsx
 * @description Table / cards directory for the Workshops Work tier.
 */

import React, { useMemo } from "react";
import { CalendarDays, Pencil, RotateCcw, Trash2, Users } from "lucide-react";
import type { WorkshopEvent } from "@mms/shared";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import { DataTableRowActions } from "@/components/common/data-table";
import { ModuleTableFooterCount } from "@/components/app/ModuleTableFooterCount";
import { EmptyState } from "@/components/app/EmptyState";
import { ModuleDirectoryCards } from "@/components/app/ModuleDirectoryCards";
import { useCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { getDirectoryPageSelection } from "@/lib/directorySelection";
import { Checkbox } from "@/components/ui/checkbox";
import {
  buildWorkshopsWorkColumns,
  formatWorkshopDates,
  formatWorkshopFill,
} from "./workshopsWorkColumns";

export interface WorkshopsDirectoryProps {
  viewMode: WorkDirectoryViewMode;
  workshops: WorkshopEvent[];
  selectedIds: string[];
  viewingDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  isLoading: boolean;
  isColumnVisible: (key: string) => boolean;
  getColumnWidth: (key: string) => number | undefined;
  onColumnResize: (key: string, width: number) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, visibleIds: string[]) => void;
  onView: (workshop: WorkshopEvent) => void;
  onEdit: (workshop: WorkshopEvent) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
}

export function WorkshopsDirectory({
  viewMode,
  workshops,
  selectedIds,
  viewingDeleted,
  canWrite,
  canDelete,
  isLoading,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  onToggleSelected,
  onToggleSelectAll,
  onView,
  onEdit,
  onDelete,
  onRestore,
}: WorkshopsDirectoryProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const pageIds = useMemo(() => workshops.map((workshop) => workshop.id), [workshops]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const { allSelected, someSelected } = getDirectoryPageSelection(pageIds, selectedIds);
  const columns = useMemo(
    () => buildWorkshopsWorkColumns(t, formatCurrency, onView, { isColumnVisible, getColumnWidth }),
    [t, formatCurrency, onView, isColumnVisible, getColumnWidth],
  );
  const pageCountLabel = formatDirectoryPageCountLabel(workshops.length, t, {
    singular: "workshops.singular",
    plural: "nav.workshops",
  });
  const selectedCountLabel = t("workshops.selectedCount", { count: selectedIds.length });

  const rowActions = (workshop: WorkshopEvent) => {
    if (viewingDeleted) {
      return canDelete
        ? [
            {
              id: "restore",
              label: t("workshops.restore"),
              icon: RotateCcw,
              onClick: () => onRestore(workshop.id),
            },
          ]
        : [];
    }
    return [
      ...(canWrite
        ? [{ id: "edit", label: t("common.edit"), icon: Pencil, onClick: () => onEdit(workshop) }]
        : []),
      ...(canDelete
        ? [
            {
              id: "delete",
              label: t("common.delete"),
              icon: Trash2,
              tone: "destructive" as const,
              onClick: () => onDelete(workshop.id),
            },
          ]
        : []),
    ];
  };

  const empty = (
    <EmptyState
      title={viewingDeleted ? t("workshops.trashEmptyTitle") : t("workshops.emptyTitle")}
      description={
        viewingDeleted ? t("workshops.trashEmptyDescription") : t("workshops.emptyDescription")
      }
    />
  );

  if (viewMode === "cards") {
    if (!isLoading && workshops.length === 0) return empty;
    return (
      <div aria-busy={isLoading || undefined}>
        <ModuleDirectoryCards
          items={workshops}
          selectedIds={selectedIds}
          onSelectAll={canDelete ? () => onToggleSelectAll(!allSelected, pageIds) : undefined}
          allSelected={allSelected}
          someSelected={someSelected}
          selectAllLabel={t("common.selectAll")}
          deselectAllLabel={t("common.deselect")}
          selectedCountLabel={selectedCountLabel}
          pageCountLabel={pageCountLabel}
          checkboxIdPrefix="workshops-select-cards"
          renderItem={(workshop) => {
            const actions = rowActions(workshop);
            return (
              <article
                key={workshop.id}
                className="rounded-lg border border-border bg-card p-4 text-start shadow-xs"
              >
                <div className="flex items-start gap-3">
                  {canDelete ? (
                    <Checkbox
                      id={`workshops-select-cards-${workshop.id}`}
                      aria-label={workshop.title}
                      checked={selectedSet.has(workshop.id)}
                      onCheckedChange={(checked) => onToggleSelected(workshop.id, checked === true)}
                      className="mt-1"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onView(workshop)}
                    className="min-h-11 flex-1 text-start font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {workshop.title}
                  </button>
                  {actions.length > 0 ? <DataTableRowActions actions={actions} /> : null}
                </div>
                <dl className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                    <dt className="sr-only">{t("workshops.dates")}</dt>
                    <dd>{formatWorkshopDates(workshop)}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-4 shrink-0" aria-hidden="true" />
                    <dt className="sr-only">{t("workshops.participants")}</dt>
                    <dd className="tabular-nums">{formatWorkshopFill(t, workshop)}</dd>
                  </div>
                </dl>
              </article>
            );
          }}
        />
      </div>
    );
  }

  return (
    <>
      <WorkBatchTable
        data={workshops}
        columns={columns}
        isLoading={isLoading}
        stickyColumnId="title"
        columnResize={{ getColumnWidth, onColumnResize }}
        selection={
          canDelete
            ? {
                selectedIds: selectedSet,
                onSelectOne: (id) => onToggleSelected(id, !selectedSet.has(id)),
                onSelectAll: () => onToggleSelectAll(!allSelected, pageIds),
                allSelected,
                someSelected,
                selectAllAriaLabel: allSelected ? t("common.deselect") : t("common.selectAll"),
                selectRowAriaLabel: (workshop) => workshop.title,
              }
            : undefined
        }
        onRowClick={onView}
        renderRowActions={(workshop) => {
          const actions = rowActions(workshop);
          return actions.length > 0 ? <DataTableRowActions actions={actions} /> : null;
        }}
        emptyState={empty}
      />
      <ModuleTableFooterCount
        selectedCount={selectedIds.length}
        selectedCountLabel={selectedCountLabel}
        pageCountLabel={pageCountLabel}
      />
    </>
  );
}
