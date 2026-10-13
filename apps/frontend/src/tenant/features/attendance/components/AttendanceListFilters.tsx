import type React from "react";
import { DateRangeFilterBar } from "@/components/app/DateRangeFilterBar";
import { type ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import { WorkTaskToolbar } from "@/components/common/work";
import { FilterChips } from "@/components/app/FilterChips";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import type { AttendanceStatus } from "@/lib/data/attendanceData";
import { AttendanceFiltersMenuButton } from "@/tenant/features/attendance/components/AttendanceFiltersMenuButton";

export const ATTENDANCE_WORK_SEARCH_INPUT_ID = "attendance-work-search";

export interface AttendanceListFiltersProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  search: string;
  handleSearchChange: (query: string) => void;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  statuses: AttendanceStatus[];
  statusLabel: (statusId: string) => string;
  dateFrom: string;
  setDateFrom: React.Dispatch<React.SetStateAction<string>>;
  dateTo: string;
  setDateTo: React.Dispatch<React.SetStateAction<string>>;
  setPage: (page: number) => void;
  canDelete?: boolean;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
}

export function AttendanceListFilters({
  viewMode,
  onViewModeChange,
  search,
  handleSearchChange,
  statusFilter,
  setStatusFilter,
  statuses,
  statusLabel,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  setPage,
  canDelete = false,
  showDeleted = false,
  onToggleDeleted,
  columnCustomizer,
}: AttendanceListFiltersProps): React.JSX.Element {
  const { t } = useTranslation();
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearFilters = (): void => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const chips = [
    ...(statusFilter !== "all"
      ? [
          {
            key: `status:${statusFilter}`,
            label: statusLabel(statusFilter),
            onRemove: () => {
              setStatusFilter("all");
              setPage(1);
            },
          },
        ]
      : []),
    ...(dateFrom
      ? [
          {
            key: "dateFrom",
            label: t("attendance.filters.dateFromChip", { date: dateFrom }),
            onRemove: () => {
              setDateFrom("");
              setPage(1);
            },
          },
        ]
      : []),
    ...(dateTo
      ? [
          {
            key: "dateTo",
            label: t("attendance.filters.dateToChip", { date: dateTo }),
            onRemove: () => {
              setDateTo("");
              setPage(1);
            },
          },
        ]
      : []),
  ];

  return (
    <WorkTaskToolbar
      regionLabel={t("attendance.tabs.records")}
      search={search}
      onSearchChange={handleSearchChange}
      searchPlaceholder={t("attendance.searchStudent")}
      searchId={ATTENDANCE_WORK_SEARCH_INPUT_ID}
      hasActiveFilters={activeFilterCount > 0}
      onClearFilters={clearFilters}
      clearFiltersLabel={t("attendance.clearFilters")}
      filterButton={
        <AttendanceFiltersMenuButton
          statusFilter={statusFilter}
          activeFilterCount={activeFilterCount}
          statuses={statuses}
          statusLabel={statusLabel}
          onChangeStatus={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          onClearFilters={clearFilters}
        />
      }
      filterChips={<FilterChips chips={chips} onClearAll={clearFilters} />}
      trashToggle={
        canDelete && onToggleDeleted
          ? {
              canViewDeleted: canDelete,
              viewingDeleted: showDeleted,
              onToggle: onToggleDeleted,
              activeLabel: t("attendance.showActive"),
              deletedLabel: t("attendance.showDeleted"),
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
    >
      <DateRangeFilterBar
        idPrefix="attendance-records"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(value) => {
          setDateFrom(value);
          setPage(1);
        }}
        onDateToChange={(value) => {
          setDateTo(value);
          setPage(1);
        }}
        pickerClassName="w-full min-w-0 max-w-full text-sm sm:max-w-filter-sm"
      />
    </WorkTaskToolbar>
  );
}
