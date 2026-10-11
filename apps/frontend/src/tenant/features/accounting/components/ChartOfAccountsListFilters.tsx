import React from "react";
import { Download } from "lucide-react";
import { type AppTranslationKey } from "@mms/shared";
import {
  ModuleFilterDivider,
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/ui/ModuleFiltersMenuButton";
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { type ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";
import { ModuleWorkToolbar } from "@/components/ui/ModuleWorkToolbar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/data/accountingData";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";

interface ChartOfAccountsListFiltersProps {
  search: string;
  setSearch: (search: string) => void;
  typeFilter: AccountType | "all";
  setTypeFilter: (typeFilter: AccountType | "all") => void;
  showInactive: boolean;
  setShowInactive: (showInactive: boolean) => void;
  onExportCsv: () => void;
  onAddAccount: () => void;
  canWrite: boolean;
  columnCustomizer?: ModuleColumnCustomizerProps;
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
}

export function ChartOfAccountsListFilters({
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  showInactive,
  setShowInactive,
  onExportCsv,
  onAddAccount,
  canWrite,
  columnCustomizer,
  viewMode,
  onViewModeChange,
}: ChartOfAccountsListFiltersProps): React.JSX.Element {
  const { t } = useTranslation();
  const activeFilterCount = Number(typeFilter !== "all") + Number(showInactive);
  const hasActiveFilters = activeFilterCount > 0;
  const handleClearFilters = (): void => {
    setTypeFilter("all");
    setShowInactive(false);
  };

  return (
    <ModuleWorkToolbar
      regionLabel={t("accounting.coa.controlsAria")}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={t("accounting.coa.searchAccounts")}
      searchId="coa-search"
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClearFilters}
      clearFiltersLabel={t("accounting.clearFilters")}
      filterButton={
        <ModuleFilterDropdown
          label={t("common.filters")}
          activeCount={activeFilterCount}
          clearLabel={t("accounting.clearFilters")}
          onClear={handleClearFilters}
        >
          <ModuleFilterRadioGroup
            label={t("accounting.coa.filterTypeAria")}
            value={typeFilter}
            onValueChange={(accountTypeValue) =>
              setTypeFilter(accountTypeValue as AccountType | "all")
            }
            options={[
              { value: "all", label: t("accounting.ledger.allTypes") },
              ...ACCOUNT_TYPES.map((type) => ({
                value: type,
                label: t(`accounting.type.${type}` as AppTranslationKey),
              })),
            ]}
          />
          <ModuleFilterDivider />
          <DropdownMenuCheckboxItem
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked === true)}
          >
            {t("accounting.coa.showInactive")}
          </DropdownMenuCheckboxItem>
        </ModuleFilterDropdown>
      }
      viewModeToggle={{ viewMode, onViewModeChange }}
      primaryAction={undefined}
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
      <Button
        type="button"
        variant="outline"
        onClick={onExportCsv}
        className="flex min-h-11 items-center gap-1.5 rounded-xl text-sm font-semibold text-muted-foreground"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />{" "}
        {t("accounting.journal.dashboard.export")}
      </Button>
    </ModuleWorkToolbar>
  );
}
