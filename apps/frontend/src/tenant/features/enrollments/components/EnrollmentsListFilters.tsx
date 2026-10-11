import type { ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";
import { FilterChips } from "@/components/ui/FilterChips";
import { WorkTaskToolbar } from "@/components/common/work";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import type { Session } from "@mms/shared";
import { EnrollmentsFiltersMenuButton } from "@/tenant/features/enrollments/components/EnrollmentsFiltersMenuButton";

export const ENROLLMENTS_WORK_SEARCH_INPUT_ID = "enrollments-work-search";

export interface EnrollmentsListFiltersProps {
  search: string;
  statusFilter: string;
  sessionFilter: string;
  sessions: Session[];
  showDeleted: boolean;
  canDelete: boolean;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  columnCustomizer: ModuleColumnCustomizerProps;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSessionChange: (value: string) => void;
  onClearFilters: () => void;
  onShowDeletedChange?: (showDeleted: boolean) => void;
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
}

export function EnrollmentsListFilters({
  search,
  statusFilter,
  sessionFilter,
  sessions,
  showDeleted,
  canDelete,
  statusConfig,
  columnCustomizer,
  onSearchChange,
  onStatusChange,
  onSessionChange,
  onClearFilters,
  onShowDeletedChange,
  viewMode,
  onViewModeChange,
}: EnrollmentsListFiltersProps): React.JSX.Element {
  const { t } = useTranslation();
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (sessionFilter !== "all" ? 1 : 0);

  const statusOptions = Object.keys(statusConfig).map((statusKey) => ({
    value: statusKey,
    label: statusConfig[statusKey]?.label ?? statusKey,
  }));
  const sessionOptions = sessions.map((sessionItem) => ({
    value: sessionItem.id,
    label: sessionItem.name,
  }));

  return (
    <WorkTaskToolbar
      regionLabel={t("enrollments.filters")}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("enrollments.searchPlaceholder")}
      searchId={ENROLLMENTS_WORK_SEARCH_INPUT_ID}
      hasActiveFilters={activeFilterCount > 0}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t("enrollments.clearFilters")}
      filterButton={
        <EnrollmentsFiltersMenuButton
          statusFilter={statusFilter}
          sessionFilter={sessionFilter}
          statusOptions={statusOptions}
          sessionOptions={sessionOptions}
          activeFilterCount={activeFilterCount}
          onStatusFilterChange={onStatusChange}
          onSessionFilterChange={onSessionChange}
          onClearFilters={onClearFilters}
        />
      }
      filterChips={
        <FilterChips
          chips={[
            ...(statusFilter !== "all"
              ? [
                  {
                    key: `status:${statusFilter}`,
                    label: statusConfig[statusFilter]?.label ?? statusFilter,
                    onRemove: () => onStatusChange("all"),
                  },
                ]
              : []),
            ...(sessionFilter !== "all"
              ? [
                  {
                    key: `session:${sessionFilter}`,
                    label: sessions.find((s) => s.id === sessionFilter)?.name ?? sessionFilter,
                    onRemove: () => onSessionChange("all"),
                  },
                ]
              : []),
          ]}
          onClearAll={onClearFilters}
        />
      }
      trashToggle={
        canDelete && onShowDeletedChange
          ? {
              canViewDeleted: canDelete,
              viewingDeleted: showDeleted,
              onToggle: () => onShowDeletedChange(!showDeleted),
              activeLabel: t("enrollments.showActive"),
              deletedLabel: t("enrollments.showDeleted"),
            }
          : undefined
      }
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={{
        registry: columnCustomizer.columnRegistry,
        onUpdate: columnCustomizer.updateUserColumnLayout,
        onReset: columnCustomizer.onResetLayout,
        labels: columnCustomizer.labels,
      }}
    />
  );
}
