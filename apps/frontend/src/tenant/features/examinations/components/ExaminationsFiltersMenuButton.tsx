import React from "react";
import { Filter } from "lucide-react";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDropdown,
} from "@/components/ui/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";

export const EXAM_STATUSES = [
  "upcoming",
  "ongoing",
  "completed",
  "scheduled",
  "cancelled",
] as const;

export interface ExaminationsFiltersMenuButtonProps {
  filterStatus: string[];
  activeFilterCount: number;
  statusLabels: Record<(typeof EXAM_STATUSES)[number], string>;
  onToggleStatus: (status: string) => void;
  onClearFilters: () => void;
}

/** Examinations Work single Filters menu — status checkbox group on shared chrome. */
export function ExaminationsFiltersMenuButton({
  filterStatus,
  activeFilterCount,
  statusLabels,
  onToggleStatus,
  onClearFilters,
}: ExaminationsFiltersMenuButtonProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleFilterDropdown
      label={t("examinations.filters")}
      activeCount={activeFilterCount}
      icon={Filter}
      clearLabel={t("examinations.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterCheckboxGroup
        label={t("examinations.filter.status")}
        options={EXAM_STATUSES.map((status) => ({
          value: status,
          label: statusLabels[status],
        }))}
        selected={filterStatus}
        onToggle={onToggleStatus}
      />
    </ModuleFilterDropdown>
  );
}
