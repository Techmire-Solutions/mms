import React from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/ui/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import type { AttendanceStatus } from "@/lib/data/attendanceData";

export interface AttendanceFiltersMenuButtonProps {
  statusFilter: string;
  activeFilterCount: number;
  statuses: AttendanceStatus[];
  statusLabel: (statusId: string) => string;
  onChangeStatus: (value: string) => void;
  onClearFilters: () => void;
}

/** Attendance Records Work single Filters menu — status radio group on shared chrome. */
export function AttendanceFiltersMenuButton({
  statusFilter,
  activeFilterCount,
  statuses,
  statusLabel,
  onChangeStatus,
  onClearFilters,
}: AttendanceFiltersMenuButtonProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleFilterDropdown
      label={t("attendance.filters")}
      activeCount={activeFilterCount}
      icon={SlidersHorizontal}
      clearLabel={t("attendance.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterRadioGroup
        label={t("attendance.filter.status")}
        options={[
          { value: "all", label: t("attendance.filter.all") },
          ...statuses.map((status) => ({
            value: status.id,
            label: statusLabel(status.id),
          })),
        ]}
        value={statusFilter}
        onValueChange={onChangeStatus}
      />
    </ModuleFilterDropdown>
  );
}
