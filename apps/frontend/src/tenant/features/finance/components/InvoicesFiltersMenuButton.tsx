import { SlidersHorizontal } from "lucide-react";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDropdown,
} from "@/components/app/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import { INVOICE_STATUSES } from "@/lib/data/financeData";
import type { AppTranslationKey } from "@mms/shared";

export interface InvoicesFiltersMenuButtonProps {
  filterStatus: string[];
  activeFilterCount: number;
  onToggleStatus: (status: string) => void;
  onClearFilters: () => void;
}

/** Finance invoices Work single Filters menu — status checkbox group on shared chrome. */
export function InvoicesFiltersMenuButton({
  filterStatus,
  activeFilterCount,
  onToggleStatus,
  onClearFilters,
}: InvoicesFiltersMenuButtonProps): React.JSX.Element {
  const { t } = useTranslation();
  const statusLabel = (status: string) => t(`finance.invoiceStatus.${status}` as AppTranslationKey);

  return (
    <ModuleFilterDropdown
      label={t("finance.filters")}
      activeCount={activeFilterCount}
      icon={SlidersHorizontal}
      clearLabel={t("finance.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterCheckboxGroup
        label={t("finance.filter.status")}
        options={INVOICE_STATUSES.map((status) => ({
          value: status,
          label: statusLabel(status),
        }))}
        selected={filterStatus}
        onToggle={onToggleStatus}
      />
    </ModuleFilterDropdown>
  );
}
