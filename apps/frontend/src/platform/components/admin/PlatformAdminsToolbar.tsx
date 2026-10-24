import React from "react";
import { Download } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { SubTabBar } from "@/components/app/SubTabBar";
import { Button } from "@shared/ui";
import { WorkTaskToolbar } from "@/components/common/work";
import type { AdminRoleFilter } from "@/platform/pages/PlatformAdminsList";
import { toColumnCustomizer, type DataTableColumnLayout } from "@/components/common/data-table";

export interface PlatformAdminsToolbarProps {
  shownCount: number;
  totalCount: number;
  superUserCount: number;
  adminCount: number;
  search: string;
  onSearchChange: (search: string) => void;
  isSearching?: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  roleFilter: AdminRoleFilter;
  onRoleFilterChange: (role: AdminRoleFilter) => void;
  viewMode: "table" | "cards";
  onViewModeChange: (viewMode: "table" | "cards") => void;
  onExportCsv: () => void;
  columnLayout?: DataTableColumnLayout;
}

export function PlatformAdminsToolbar({
  shownCount,
  totalCount,
  superUserCount,
  adminCount,
  search,
  onSearchChange,
  isSearching = false,
  hasActiveFilters,
  onClearFilters,
  roleFilter,
  onRoleFilterChange,
  viewMode,
  onViewModeChange,
  onExportCsv,
  columnLayout,
}: PlatformAdminsToolbarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <WorkTaskToolbar
      regionLabel={t("platform.manageAdmins")}
      shownCountLabel={t("platform.shownCountOfTotal", { shown: shownCount, total: totalCount })}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("platform.searchAdminsPlaceholder")}
      searchId="platform-admins-search"
      isSearching={isSearching}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t("common.clearFilters")}
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={toColumnCustomizer(columnLayout)}
      primaryAction={
        <Button
          variant="outline"
          icon={Download}
          onClick={onExportCsv}
          disabled={shownCount === 0}
          title={t("platform.exportAdminsCsv")}
        >
          {t("platform.exportAdminsCsv")}
        </Button>
      }
    >
      <SubTabBar
        tabs={[
          { key: "all", label: `${t("platform.roleAll")} (${totalCount})` },
          { key: "super_user", label: `${t("platform.roleSuperUser")} (${superUserCount})` },
          { key: "admin", label: `${t("platform.roleAdmin")} (${adminCount})` },
        ]}
        value={roleFilter}
        onChange={(k) => onRoleFilterChange(k as AdminRoleFilter)}
      />
    </WorkTaskToolbar>
  );
}
