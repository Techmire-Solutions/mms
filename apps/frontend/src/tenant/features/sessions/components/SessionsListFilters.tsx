import type { ModuleColumnRegistryEntry } from "@mms/shared";
import { FilterChips } from "@/components/app/FilterChips";
import { ModuleWorkToolbar } from "@/components/app/ModuleWorkToolbar";
import type { ModuleColumnCustomizerLabels } from "@/components/app/ModuleColumnCustomizer";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import type { SessionStatus, SessionType } from "@/tenant/features/sessions/lib/sessionPageTypes";
import { SESSIONS_WORK_SEARCH_INPUT_ID } from "@/tenant/features/sessions/hooks/useSessionsKeyboardShortcuts";
import { SessionsFiltersMenuButton } from "@/tenant/features/sessions/components/SessionsFiltersMenuButton";

export interface SessionsListColumnLayout {
  columnRegistry: ModuleColumnRegistryEntry[];
  updateUserColumnLayout: (columnRegistry: ModuleColumnRegistryEntry[]) => void;
  customizerLabels?: ModuleColumnCustomizerLabels;
  resetColumnLayout?: () => void;
}

export interface SessionsListFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  filterStatus: SessionStatus[];
  filterType: SessionType[];
  statusOptions: string[];
  typeOptions: string[];
  statusLabels: Record<string, string>;
  typeLabels: Record<string, string>;
  activeFilterCount: number;
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  columnLayout: SessionsListColumnLayout;
  canDelete: boolean;
  showDeleted: boolean;
  onStatusFilterToggle: (status: SessionStatus) => void;
  onTypeFilterToggle: (type: SessionType) => void;
  onClearFilters: () => void;
  onToggleDeleted: () => void;
}

export function SessionsListFilters({
  search,
  onSearchChange,
  filterStatus,
  filterType,
  statusOptions,
  typeOptions,
  statusLabels,
  typeLabels,
  activeFilterCount,
  viewMode,
  onViewModeChange,
  columnLayout,
  canDelete,
  showDeleted,
  onStatusFilterToggle,
  onTypeFilterToggle,
  onClearFilters,
  onToggleDeleted,
}: SessionsListFiltersProps) {
  const { t } = useTranslation();

  return (
    <ModuleWorkToolbar
      regionLabel={t("nav.sessions")}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("sessions.searchPlaceholder")}
      searchId={SESSIONS_WORK_SEARCH_INPUT_ID}
      hasActiveFilters={activeFilterCount > 0}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t("sessions.clearFilters")}
      filterButton={
        <SessionsFiltersMenuButton
          filterStatus={filterStatus}
          filterType={filterType}
          statusOptions={statusOptions}
          typeOptions={typeOptions}
          statusLabels={statusLabels}
          typeLabels={typeLabels}
          activeFilterCount={activeFilterCount}
          onStatusFilterToggle={onStatusFilterToggle}
          onTypeFilterToggle={onTypeFilterToggle}
          onClearFilters={onClearFilters}
        />
      }
      filterChips={
        <FilterChips
          chips={[
            ...filterStatus.map((statusOption) => ({
              key: statusOption,
              label: statusLabels[statusOption] ?? statusOption,
              onRemove: () => onStatusFilterToggle(statusOption),
            })),
            ...filterType.map((typeOption) => ({
              key: typeOption,
              label: typeLabels[typeOption] ?? typeOption,
              onRemove: () => onTypeFilterToggle(typeOption),
            })),
          ]}
          onClearAll={onClearFilters}
        />
      }
      trashToggle={
        canDelete
          ? {
              canViewDeleted: canDelete,
              viewingDeleted: showDeleted,
              onToggle: onToggleDeleted,
              activeLabel: t("sessions.showActive"),
              deletedLabel: t("sessions.showDeleted"),
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
