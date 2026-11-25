import React, { useMemo } from "react";
import { ModuleDirectoryCards } from "@mms/fe-core/components/ModuleDirectoryCards";
import { formatDirectoryPageCountLabel } from "@mms/fe-core/tenant/formatDirectoryPageCountLabel";
import { useReducedMotion } from "@mms/fe-core/tenant";
import { useTranslation } from "@mms/fe-core/i18n";
import { useFacultyEntityDescriptor } from "../hooks/useFacultyEntityDescriptor";
import { FacultyCardItem } from "./FacultyCardItem";
import type { FacultyListContentProps } from "../lib/facultyListContentShared";

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
    <ModuleDirectoryCards
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
