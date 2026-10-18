import React from "react";
import { Globe, Ban, Download, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { SubTabBar } from "@/components/app/SubTabBar";
import { Button, DensityToggle } from "@shared/ui";
import { WorkTaskToolbar } from "@/components/common/work";
import { PlatformWorkspaceSortMenu } from "@/platform/components/PlatformWorkspaceSortMenu";
import type {
  WorkspaceSortDirection,
  WorkspaceSortField,
} from "@/platform/components/platformWorkspaceListData";

import type { PlatformDensity } from "@/platform/hooks/usePlatformDensity";
import { toColumnCustomizer, type DataTableColumnLayout } from "@/components/common/data-table";

export interface PlatformWorkspaceToolbarProps {
  shownCount: number;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  search: string;
  onSearchChange: (search: string) => void;
  isSearching: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  viewMode: "table" | "cards";
  onViewModeChange: (viewMode: "table" | "cards") => void;
  density?: PlatformDensity;
  onDensityChange?: (density: PlatformDensity) => void;
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (status: "all" | "active" | "inactive") => void;
  sortField: WorkspaceSortField;
  sortDirection: WorkspaceSortDirection;
  onToggleSort: (field: WorkspaceSortField) => void;
  onRefetch: () => void;
  onExportCsv: () => void;
  columnLayout?: DataTableColumnLayout;
}

export function PlatformWorkspaceToolbar({
  shownCount,
  totalCount,
  activeCount,
  inactiveCount,
  search,
  onSearchChange,
  isSearching,
  hasActiveFilters,
  onClearFilters,
  viewMode,
  onViewModeChange,
  density,
  onDensityChange,
  statusFilter,
  onStatusFilterChange,
  sortField,
  sortDirection,
  onToggleSort,
  onRefetch,
  onExportCsv,
  columnLayout,
}: PlatformWorkspaceToolbarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <WorkTaskToolbar
      regionLabel={t("platform.manageMadrasas")}
      shownCountLabel={t("platform.shownCountOfTotal", { shown: shownCount, total: totalCount })}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("common.search")}
      searchId="platform-workspaces-search"
      isSearching={isSearching}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t("common.clearFilters")}
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={toColumnCustomizer(columnLayout)}
      filterButton={
        <div className="flex items-center gap-2">
          {onDensityChange && viewMode === "table" && (
            <DensityToggle
              density={density ?? "standard"}
              onChange={onDensityChange}
              ariaLabel={t("dashboard.layoutDensity")}
              labels={{
                compact: t("dashboard.densityCompact"),
                standard: t("dashboard.densityStandard"),
                comfortable: t("dashboard.densityComfortable"),
              }}
            />
          )}
          <PlatformWorkspaceSortMenu
            sortField={sortField}
            sortDirection={sortDirection}
            onToggleSort={onToggleSort}
          />
        </div>
      }
      primaryAction={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={isSearching}
            onClick={onRefetch}
            className="min-w-11"
            title={t("common.refresh")}
            aria-label={t("common.refresh")}
          />
          <Button
            variant="outline"
            icon={Download}
            onClick={onExportCsv}
            disabled={shownCount === 0}
            title={t("platform.exportWorkspacesCsv")}
          >
            {t("platform.exportWorkspacesCsv")}
          </Button>
        </div>
      }
    >
      <SubTabBar
        tabs={[
          { key: "all", label: `${t("platform.filterAll")} (${totalCount})` },
          {
            key: "active",
            label: `${t("platform.workspaceActive")} (${activeCount})`,
            icon: Globe,
          },
          {
            key: "inactive",
            label: `${t("platform.workspaceInactive")} (${inactiveCount})`,
            icon: Ban,
          },
        ]}
        value={statusFilter}
        onChange={onStatusFilterChange}
      />
    </WorkTaskToolbar>
  );
}
