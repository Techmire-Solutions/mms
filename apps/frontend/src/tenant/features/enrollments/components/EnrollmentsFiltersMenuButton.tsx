import { SlidersHorizontal } from "lucide-react";
import {
  ModuleFilterDivider,
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/ui/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";

export interface EnrollmentsFiltersMenuButtonProps {
  statusFilter: string;
  sessionFilter: string;
  statusOptions: { value: string; label: string }[];
  sessionOptions: { value: string; label: string }[];
  activeFilterCount: number;
  onStatusFilterChange: (value: string) => void;
  onSessionFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

/** Enrollments Work single Filters menu — status + session radio groups on shared chrome. */
export function EnrollmentsFiltersMenuButton({
  statusFilter,
  sessionFilter,
  statusOptions,
  sessionOptions,
  activeFilterCount,
  onStatusFilterChange,
  onSessionFilterChange,
  onClearFilters,
}: EnrollmentsFiltersMenuButtonProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleFilterDropdown
      label={t("enrollments.filters")}
      activeCount={activeFilterCount}
      icon={SlidersHorizontal}
      clearLabel={t("enrollments.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterRadioGroup
        label={t("enrollments.filter.status")}
        options={[{ value: "all", label: t("enrollments.filter.all") }, ...statusOptions]}
        value={statusFilter}
        onValueChange={onStatusFilterChange}
      />

      <ModuleFilterDivider />

      <ModuleFilterRadioGroup
        label={t("enrollments.filter.session")}
        options={[{ value: "all", label: t("enrollments.filter.allSessions") }, ...sessionOptions]}
        value={sessionFilter}
        onValueChange={onSessionFilterChange}
      />
    </ModuleFilterDropdown>
  );
}
