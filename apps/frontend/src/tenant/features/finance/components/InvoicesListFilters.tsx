import type React from "react";
import type { ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import { WorkListFiltersScaffold, type WorkListFilterChip } from "@/components/common/work";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey } from "@mms/shared";
import { InvoicesFiltersMenuButton } from "@/tenant/features/finance/components/InvoicesFiltersMenuButton";

export const FINANCE_INVOICES_WORK_SEARCH_INPUT_ID = "finance-invoices-work-search";

export interface InvoicesListFiltersProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  search: string;
  filterStatus: string[];
  canDelete?: boolean;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onSearchChange: (value: string) => void;
  onToggleStatus: (status: string) => void;
  onClearStatuses: () => void;
}

export function InvoicesListFilters({
  viewMode,
  onViewModeChange,
  search,
  filterStatus,
  canDelete = false,
  showDeleted = false,
  onToggleDeleted,
  columnCustomizer,
  onSearchChange,
  onToggleStatus,
  onClearStatuses,
}: InvoicesListFiltersProps): React.JSX.Element {
  const { t } = useTranslation();
  const statusLabel = (status: string) => t(`finance.invoiceStatus.${status}` as AppTranslationKey);

  const chips: WorkListFilterChip[] = filterStatus.map((status) => ({
    key: `status:${status}`,
    label: statusLabel(status),
    onRemove: () => onToggleStatus(status),
  }));

  return (
    <WorkListFiltersScaffold
      regionLabel={t("finance.invoices")}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("finance.searchInvoices")}
      searchId={FINANCE_INVOICES_WORK_SEARCH_INPUT_ID}
      activeFilterCount={filterStatus.length}
      clearFiltersLabel={t("finance.clearFilters")}
      onClearFilters={onClearStatuses}
      filterButton={
        <InvoicesFiltersMenuButton
          filterStatus={filterStatus}
          activeFilterCount={filterStatus.length}
          onToggleStatus={onToggleStatus}
          onClearFilters={onClearStatuses}
        />
      }
      chips={chips}
      trashToggle={
        canDelete && onToggleDeleted
          ? {
              canViewDeleted: canDelete,
              viewingDeleted: showDeleted,
              onToggle: onToggleDeleted,
              activeLabel: t("finance.trash.showActive"),
              deletedLabel: t("finance.trash.showDeleted"),
            }
          : undefined
      }
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={columnCustomizer}
    />
  );
}
