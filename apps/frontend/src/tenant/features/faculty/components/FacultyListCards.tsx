import React, { useMemo } from "react";
import { EntityCardsGrid } from "@/components/ui/EntityCardsGrid";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { useFacultyEntityDescriptor } from "@/tenant/features/faculty/hooks/useFacultyEntityDescriptor";
import { FacultyCardItem } from "@/tenant/features/faculty/components/FacultyCardItem";
import type { FacultyListContentProps } from "@/tenant/features/faculty/components/facultyListContentShared";

export interface FacultyListCardsProps extends Omit<
  FacultyListContentProps,
  | "sortField"
  | "sortDir"
  | "getColumnWidth"
  | "onColumnResize"
  | "onSort"
  | "viewMode"
  | "hasActiveFilters"
  | "onClearFilters"
  | "onShowActive"
> {
  faculty?: FacultyListContentProps["faculty"];
}

export function FacultyListCards(props: FacultyListCardsProps): React.JSX.Element {
  const {
    faculty,
    selectedIds,
    allSelected,
    someSelected,
    showDeleted,
    canWrite,
    canDelete,
    isColumnVisible,
    columnRegistry,
    customFieldsById,
    statusConfig,
    onSelectAll,
    onSelectOne,
    onView,
    onEdit,
    onRequestDelete,
    onRestore,
    onSms,
    onWhatsApp,
    onEmail,
  } = props;
  const items = faculty ?? [];
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const descriptor = useFacultyEntityDescriptor();
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pageCountLabel = formatDirectoryPageCountLabel(items.length, t, {
    singular: "faculty.form.faculty",
    plural: "faculty.table.faculty",
  });

  return (
    <EntityCardsGrid
      items={items}
      selectedIds={selectedIds}
      onSelectAll={onSelectAll}
      allSelected={allSelected}
      someSelected={someSelected}
      selectAllLabel={t("faculty.table.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("faculty.selectedCount", { count: selectedIds.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="faculty-cards"
      renderItem={(faculty) => (
        <FacultyCardItem
          key={faculty.id}
          faculty={faculty}
          selectedSet={selectedSet}
          selectedIds={selectedIds}
          showDeleted={showDeleted}
          canWrite={canWrite}
          canDelete={canDelete}
          isColumnVisible={isColumnVisible}
          columnRegistry={columnRegistry}
          customFieldsById={customFieldsById}
          statusConfig={statusConfig}
          descriptor={descriptor}
          reducedMotion={reducedMotion}
          onSelectOne={onSelectOne}
          onView={onView}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
          onRestore={onRestore}
          onSms={onSms}
          onWhatsApp={onWhatsApp}
          onEmail={onEmail}
        />
      )}
    />
  );
}
