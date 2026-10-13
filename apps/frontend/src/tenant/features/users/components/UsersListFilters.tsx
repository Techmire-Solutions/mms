import type { JSX } from "react";
import React from "react";
import {
  workspaceRoleLabel,
  type ModuleColumnRegistryEntry,
  type WorkspaceRole,
} from "@mms/shared";
import {
  ModuleFilterDivider,
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/app/ModuleFiltersMenuButton";
import { WorkTaskToolbar } from "@/components/common/work";
import { useTranslation } from "@/hooks/useTranslation";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { ModuleColumnCustomizerLabels } from "@/components/app/ModuleColumnCustomizer";
import { USERS_WORK_SEARCH_INPUT_ID } from "@/tenant/features/users/hooks/useUsersKeyboardShortcuts";

interface UsersListFiltersProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  search: string;
  roleFilter: string;
  statusFilter: string;
  workspaceRoles: WorkspaceRole[];
  canDelete: boolean;
  showDeleted: boolean;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onToggleDeleted?: (next: boolean) => void;
  onClearSelection: () => void;
  columnRegistry?: ModuleColumnRegistryEntry[];
  updateUserColumnLayout?: (columnRegistry: ModuleColumnRegistryEntry[]) => void;
  onResetLayout?: () => void;
  customizerLabels?: ModuleColumnCustomizerLabels;
  primaryAction?: React.ReactNode;
}

export function UsersListFilters({
  search,
  roleFilter,
  statusFilter,
  workspaceRoles,
  canDelete,
  showDeleted,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onToggleDeleted,
  onClearSelection,
  viewMode,
  onViewModeChange,
  columnRegistry,
  updateUserColumnLayout,
  onResetLayout,
  customizerLabels,
  primaryAction,
}: UsersListFiltersProps): JSX.Element {
  const { t } = useTranslation();
  const activeFilterCount =
    Number(roleFilter !== "all") + Number(!showDeleted && statusFilter !== "all");
  const hasActiveFilters = activeFilterCount > 0;
  const handleClearFilters = (): void => {
    onRoleFilterChange("all");
    onStatusFilterChange("all");
  };

  return (
    <WorkTaskToolbar
      regionLabel={t("page.users.title")}
      searchId={USERS_WORK_SEARCH_INPUT_ID}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("users.searchPlaceholder")}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClearFilters}
      clearFiltersLabel={t("common.clearFilters")}
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={
        columnRegistry && updateUserColumnLayout
          ? {
              registry: columnRegistry,
              onUpdate: updateUserColumnLayout,
              onReset: onResetLayout,
              labels: customizerLabels,
            }
          : undefined
      }
      trashToggle={
        canDelete
          ? {
              canViewDeleted: true,
              viewingDeleted: showDeleted,
              onToggle: (v) => {
                onClearSelection();
                onToggleDeleted?.(v);
              },
              activeLabel: t("users.trash.showActive"),
              deletedLabel: t("users.trash.showDeleted"),
            }
          : undefined
      }
      primaryAction={primaryAction}
      filterButton={
        <ModuleFilterDropdown
          label={t("common.filters")}
          activeCount={activeFilterCount}
          clearLabel={t("common.clearFilters")}
          onClear={handleClearFilters}
        >
          <ModuleFilterRadioGroup
            label={t("users.filterRole")}
            value={roleFilter}
            onValueChange={onRoleFilterChange}
            options={[
              { value: "all", label: t("users.filterAllRoles") },
              ...workspaceRoles.map((workspaceRole) => ({
                value: workspaceRole.id,
                label: workspaceRoleLabel(workspaceRole, t),
              })),
            ]}
          />
          {!showDeleted ? (
            <>
              <ModuleFilterDivider />
              <ModuleFilterRadioGroup
                label={t("users.filterStatus")}
                value={statusFilter}
                onValueChange={onStatusFilterChange}
                options={[
                  { value: "all", label: t("users.filterAllStatuses") },
                  { value: "active", label: t("users.status.active") },
                  { value: "inactive", label: t("users.status.inactive") },
                  { value: "suspended", label: t("users.status.suspended") },
                ]}
              />
            </>
          ) : null}
        </ModuleFilterDropdown>
      }
    />
  );
}
