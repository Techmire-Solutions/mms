import type { JSX } from "react";
import { Filter } from "lucide-react";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDropdown,
} from "@/components/ui/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import type { Distribution } from "@/lib/data/hasanatData";

type DistributionStatus = Distribution["status"];

const DISTRIBUTION_STATUSES: DistributionStatus[] = ["active", "redeemed", "returned"];

interface HasanatFiltersMenuButtonProps {
  filterStatus: DistributionStatus[];
  activeFilterCount: number;
  statusLabels: Record<DistributionStatus, string>;
  onToggleStatus: (status: DistributionStatus) => void;
  onClearFilters: () => void;
}

/** Hasanat Work single Filters menu — status checkbox group on shared chrome. */
export function HasanatFiltersMenuButton({
  filterStatus,
  activeFilterCount,
  statusLabels,
  onToggleStatus,
  onClearFilters,
}: HasanatFiltersMenuButtonProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleFilterDropdown
      label={t("hasanat.filters")}
      activeCount={activeFilterCount}
      icon={Filter}
      clearLabel={t("hasanat.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterCheckboxGroup
        label={t("hasanat.filter.status")}
        options={DISTRIBUTION_STATUSES.map((status) => ({
          value: status,
          label: statusLabels[status],
        }))}
        selected={filterStatus}
        onToggle={(status) => onToggleStatus(status as DistributionStatus)}
      />
    </ModuleFilterDropdown>
  );
}
