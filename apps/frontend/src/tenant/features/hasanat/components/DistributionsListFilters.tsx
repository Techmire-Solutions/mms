import { FilterChips } from "@/components/app/FilterChips";
import { type ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import { WorkTaskToolbar } from "@/components/common/work";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import type { Distribution } from "@/lib/data/hasanatData";
import { HasanatFiltersMenuButton } from "@/tenant/features/hasanat/components/HasanatFiltersMenuButton";

type DistributionStatus = Distribution["status"];

export const HASANAT_WORK_SEARCH_INPUT_ID = "hasanat-work-search";

interface DistributionsListFiltersProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  search: string;
  filterStatus: DistributionStatus[];
  statusLabels: Record<DistributionStatus, string>;
  canWrite: boolean;
  canDelete?: boolean;
  showDeleted: boolean;
  onToggleDeleted?: () => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onSearchChange: (value: string) => void;
  onToggleStatus: (status: DistributionStatus) => void;
  onClearStatuses: () => void;
  onOpenModal: () => void;
}

export function DistributionsListFilters({
  viewMode,
  onViewModeChange,
  search,
  filterStatus,
  statusLabels,
  canWrite,
  canDelete = false,
  showDeleted,
  onToggleDeleted,
  columnCustomizer,
  onSearchChange,
  onToggleStatus,
  onClearStatuses,
  onOpenModal,
}: DistributionsListFiltersProps): JSX.Element {
  const { t } = useTranslation();

  const filterChips =
    filterStatus.length > 0 ? (
      <FilterChips
        chips={filterStatus.map((status) => ({
          key: `status:${status}`,
          label: statusLabels[status],
          onRemove: () => onToggleStatus(status),
        }))}
        onClearAll={onClearStatuses}
      />
    ) : null;

  return (
    <WorkTaskToolbar
      regionLabel={t("hasanat.tabs.distribute")}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("hasanat.searchDistributions")}
      searchId={HASANAT_WORK_SEARCH_INPUT_ID}
      hasActiveFilters={filterStatus.length > 0}
      onClearFilters={onClearStatuses}
      clearFiltersLabel={t("hasanat.clearFilters")}
      filterChips={filterChips}
      filterButton={
        <HasanatFiltersMenuButton
          filterStatus={filterStatus}
          activeFilterCount={filterStatus.length}
          statusLabels={statusLabels}
          onToggleStatus={onToggleStatus}
          onClearFilters={onClearStatuses}
        />
      }
      primaryAction={undefined}
      trashToggle={
        canDelete && onToggleDeleted
          ? {
              canViewDeleted: canDelete,
              viewingDeleted: showDeleted,
              onToggle: onToggleDeleted,
              activeLabel: t("hasanat.trash.showActive"),
              deletedLabel: t("hasanat.trash.showDeleted"),
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
