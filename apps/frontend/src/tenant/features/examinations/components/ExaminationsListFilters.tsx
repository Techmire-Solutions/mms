import React from "react";
import { type ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";
import { FilterChips } from "@/components/ui/FilterChips";
import { WorkTaskToolbar } from "@/components/common/work";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ExaminationsFiltersMenuButton,
  type EXAM_STATUSES,
} from "@/tenant/features/examinations/components/ExaminationsFiltersMenuButton";

export const EXAMINATIONS_WORK_SEARCH_INPUT_ID = "examinations-work-search";

export interface ExaminationsListFiltersProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  search: string;
  filterStatus: string[];
  canWrite: boolean;
  canDelete?: boolean;
  showDeleted: boolean;
  onToggleDeleted?: () => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  statusLabels: Record<(typeof EXAM_STATUSES)[number], string>;
  onSearchChange: (value: string) => void;
  onToggleStatus: (status: string) => void;
  onClearStatuses: () => void;
  onNew: () => void;
}

export function ExaminationsListFilters({
  viewMode,
  onViewModeChange,
  search,
  filterStatus,
  canWrite,
  canDelete = false,
  showDeleted,
  onToggleDeleted,
  columnCustomizer,
  statusLabels,
  onSearchChange,
  onToggleStatus,
  onClearStatuses,
  onNew,
}: ExaminationsListFiltersProps): React.JSX.Element {
  const { t } = useTranslation();

  const clearFilters = (): void => {
    onClearStatuses();
  };

  return (
    <WorkTaskToolbar
      regionLabel={t("nav.examinations")}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("examinations.searchExams")}
      searchId={EXAMINATIONS_WORK_SEARCH_INPUT_ID}
      hasActiveFilters={filterStatus.length > 0}
      onClearFilters={clearFilters}
      clearFiltersLabel={t("examinations.clearFilters")}
      filterButton={
        <ExaminationsFiltersMenuButton
          filterStatus={filterStatus}
          activeFilterCount={filterStatus.length}
          statusLabels={statusLabels}
          onToggleStatus={onToggleStatus}
          onClearFilters={clearFilters}
        />
      }
      filterChips={
        <FilterChips
          chips={filterStatus.map((status) => ({
            key: `status:${status}`,
            label: statusLabels[status as (typeof EXAM_STATUSES)[number]],
            onRemove: () => onToggleStatus(status),
          }))}
          onClearAll={clearFilters}
        />
      }
      primaryAction={undefined}
      trashToggle={
        canDelete && onToggleDeleted
          ? {
              canViewDeleted: canDelete,
              viewingDeleted: showDeleted,
              onToggle: onToggleDeleted,
              activeLabel: t("examinations.trash.showActive"),
              deletedLabel: t("examinations.trash.showDeleted"),
            }
          : undefined
      }
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={
        columnCustomizer
          ? {
              registry: columnCustomizer.columnRegistry,
              onUpdate: columnCustomizer.updateUserColumnLayout,
              onReset: columnCustomizer.onResetLayout,
              labels: columnCustomizer.labels,
            }
          : undefined
      }
    />
  );
}
