import React from "react";
import { Filter } from "lucide-react";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDropdown,
} from "@/components/app/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import { EXAM_STATUSES, isExamStatus, type ExamStatus } from "@mms/shared";

export interface ExaminationsFiltersMenuButtonProps {
  filterStatus: string[];
  activeFilterCount: number;
  statusLabels: Record<ExamStatus, string>;
  onToggleStatus: (status: ExamStatus) => void;
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
        onToggle={(value) => {
          if (isExamStatus(value)) onToggleStatus(value);
        }}
      />
    </ModuleFilterDropdown>
  );
}
