import { useMemo } from "react";
import type React from "react";
import type { StudentsQuickFilter } from "@mms/shared";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { WorkTaskToolbar } from "@/components/common/work";
import type { useStudentColumnLayout } from "@/tenant/features/students/hooks/useStudentColumnLayout";
import { StudentsFiltersMenuButton } from "@/tenant/features/students/components/StudentsFiltersMenuButton";
import type { StudentsListContentSortField } from "@/tenant/features/students/lib/studentsListTypes";
import {
  getStudentVisibleWorkColumns,
  toStudentsListContentSortField,
} from "@/tenant/features/students/lib/studentsListVisibleColumns";
import { STUDENTS_WORK_SEARCH_INPUT_ID } from "@/tenant/features/students/hooks/useStudentsKeyboardShortcuts";

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
  onSortChange: (field: StudentsListContentSortField) => void;
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
      regionLabel={t("students.filters")}
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
