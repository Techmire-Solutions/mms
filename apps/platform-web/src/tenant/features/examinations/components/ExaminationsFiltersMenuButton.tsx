import React from "react";
import { Filter } from "lucide-react";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDropdown,
} from "@mms/ui/app/ModuleFiltersMenuButton";
import { useTranslation } from "@mms/fe-core/i18n";
import { EXAM_STATUSES, isExamStatus, type ExamStatus } from "@mms/contracts";

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
