import { useMemo } from "react";
import type React from "react";
import type { StudentsQuickFilter } from "@mms/contracts";
import type { WorkDirectoryViewMode } from "@mms/fe-core/tenant";
import { useTranslation } from "@mms/fe-core/i18n";
import { WorkTaskToolbar } from "@mms/fe-core/components/WorkTaskToolbar";
import type { useStudentColumnLayout } from "../hooks/useStudentColumnLayout";
import { StudentsFiltersMenuButton } from "./StudentsFiltersMenuButton";
import type { StudentsListContentSortField } from "../lib/studentsListTypes";
import {
  getStudentVisibleWorkColumns,
  toStudentsListContentSortField,
} from "../lib/studentsListVisibleColumns";
import { STUDENTS_WORK_SEARCH_INPUT_ID } from "../hooks/useStudentsKeyboardShortcuts";

interface StudentsListFiltersProps {
  studentSearch: string;
  studentFilterStatus: string[];
  studentFilterGender: string;
  quickFilter: StudentsQuickFilter;
  onQuickFilterChange: (preset: string) => void;
  studentStatusOptions: readonly string[];
  genderFilters: string[];
  viewingDeleted: boolean;
  canDelete: boolean;
  isStatusEnabled?: boolean;
  isGenderEnabled?: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  columnLayout: ReturnType<typeof useStudentColumnLayout>;
  viewMode: WorkDirectoryViewMode;
  sortField: StudentsListContentSortField | null;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  onSearchChange: (value: string) => void;
  onToggleStatus: (status: string) => void;
  onGenderChange: (value: string) => void;
  onSortChange: (field: StudentsListContentSortField | null) => void;
  onToggleDeleted: () => void;
  onClearFilters: () => void;
  shownCount?: number;
  filterChips?: React.ReactNode;
}

export function StudentsListFilters({
  studentSearch,
  studentFilterStatus,
  studentFilterGender,
  quickFilter,
  onQuickFilterChange,
  studentStatusOptions,
  genderFilters,
  viewingDeleted,
  canDelete,
  isStatusEnabled = true,
  isGenderEnabled = true,
  hasActiveFilters,
  activeFilterCount,
  columnLayout,
  viewMode,
  sortField,
  onViewModeChange,
  onSearchChange,
  onToggleStatus,
  onGenderChange,
  onSortChange,
  onToggleDeleted,
  onClearFilters,
  shownCount,
  filterChips,
}: StudentsListFiltersProps): React.JSX.Element {
  const { t } = useTranslation();

  const sortOptions = useMemo(
    () =>
      getStudentVisibleWorkColumns(columnLayout.columnRegistry, columnLayout.isColumnVisible)
        .map((col) => {
          const field = toStudentsListContentSortField(col.key);
          return field ? { field, label: col.label } : null;
        })
        .filter(
          (option): option is { field: StudentsListContentSortField; label: string } =>
            option !== null,
        ),
    [columnLayout.columnRegistry, columnLayout.isColumnVisible],
  );

  return (
    <WorkTaskToolbar
      shownCountLabel={
        shownCount != null ? t("students.shownCount", { count: shownCount }) : undefined
      }
      regionLabel={t("nav.students")}
      search={studentSearch}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("students.searchPlaceholder")}
      searchId={STUDENTS_WORK_SEARCH_INPUT_ID}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t("students.clearFilters")}
      filterChips={filterChips}
      filterButton={
        <StudentsFiltersMenuButton
          studentFilterStatus={studentFilterStatus}
          studentFilterGender={studentFilterGender}
          quickFilter={quickFilter}
          onQuickFilterChange={onQuickFilterChange}
          studentStatusOptions={studentStatusOptions}
          genderFilters={genderFilters}
          isStatusEnabled={isStatusEnabled}
          isGenderEnabled={isGenderEnabled}
          activeFilterCount={activeFilterCount}
          sortField={sortField}
          sortOptions={sortOptions}
          onToggleStatus={onToggleStatus}
          onGenderChange={onGenderChange}
          onSortChange={onSortChange}
          onClearFilters={onClearFilters}
        />
      }
      trashToggle={
        canDelete
          ? {
              canViewDeleted: canDelete,
              viewingDeleted,
              onToggle: onToggleDeleted,
              activeLabel: t("students.showActive"),
              deletedLabel: t("students.showDeleted"),
            }
          : undefined
      }
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={{
        registry: columnLayout.columnRegistry,
        onUpdate: columnLayout.updateUserColumnLayout,
        onReset: columnLayout.resetColumnLayout,
        labels: columnLayout.customizerLabels,
      }}
    />
  );
}
