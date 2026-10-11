import { FilterChips } from "@/components/ui/FilterChips";
import { type ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";
import { WorkTaskToolbar } from "@/components/common/work";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import type { ObligationType } from "@/lib/data/obligationsData";
import { ObligationsFiltersMenuButton } from "@/tenant/features/obligations/components/ObligationsFiltersMenuButton";

export const OBLIGATIONS_WORK_SEARCH_INPUT_ID = "obligations-work-search";

interface ObligationCollectionsListFiltersProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  search: string;
  typeFilter: string;
  obligationTypes: ObligationType[];
  canDelete?: boolean;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
}

export function ObligationCollectionsListFilters({
  viewMode,
  onViewModeChange,
  search,
  typeFilter,
  obligationTypes,
  canDelete = false,
  showDeleted = false,
  onToggleDeleted,
  columnCustomizer,
  onSearchChange,
  onTypeFilterChange,
}: ObligationCollectionsListFiltersProps): React.JSX.Element {
  const { t } = useTranslation();
  const activeFilterCount = typeFilter !== "all" ? 1 : 0;
  const selectedType = obligationTypes.find((item) => item.id === typeFilter);

  const filterChips =
    activeFilterCount > 0 ? (
      <FilterChips
        chips={[
          {
            key: `type:${typeFilter}`,
            label: selectedType?.name ?? t("obligations.filter.allTypes"),
            onRemove: () => onTypeFilterChange("all"),
          },
        ]}
        onClearAll={() => onTypeFilterChange("all")}
      />
    ) : null;

  return (
    <WorkTaskToolbar
      regionLabel={t("obligations.collections")}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("obligations.searchPlaceholder")}
      searchId={OBLIGATIONS_WORK_SEARCH_INPUT_ID}
      hasActiveFilters={activeFilterCount > 0}
      onClearFilters={() => onTypeFilterChange("all")}
      clearFiltersLabel={t("obligations.clearFilters")}
      filterChips={filterChips}
      filterButton={
        <ObligationsFiltersMenuButton
          typeFilter={typeFilter}
          obligationTypes={obligationTypes}
          activeFilterCount={activeFilterCount}
          onChangeType={onTypeFilterChange}
          onClearFilters={() => onTypeFilterChange("all")}
        />
      }
      trashToggle={
        canDelete && onToggleDeleted
          ? {
              canViewDeleted: canDelete,
              viewingDeleted: showDeleted,
              onToggle: onToggleDeleted,
              activeLabel: t("obligations.trash.showActive"),
              deletedLabel: t("obligations.trash.showDeleted"),
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
