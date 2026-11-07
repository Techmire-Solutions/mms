import { SlidersHorizontal } from "lucide-react";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDivider,
  ModuleFilterDropdown,
} from "@/components/app/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import { parseSessionStatus } from "@mms/shared";
import type { SessionStatus } from "@/tenant/features/sessions/lib/sessionPageTypes";

export interface SessionsFiltersMenuButtonProps {
  filterStatus: SessionStatus[];
  filterType: string[];
  statusOptions: SessionStatus[];
  typeOptions: string[];
  statusLabels: Record<string, string>;
  typeLabels: Record<string, string>;
  activeFilterCount: number;
  onStatusFilterToggle: (status: SessionStatus) => void;
  onTypeFilterToggle: (type: string) => void;
  onClearFilters: () => void;
}

/** Sessions Work single Filters menu — Contacts/Students/Teachers-shaped status + type. */
export function SessionsFiltersMenuButton({
  filterStatus,
  filterType,
  statusOptions,
  typeOptions,
  statusLabels,
  typeLabels,
  activeFilterCount,
  onStatusFilterToggle,
  onTypeFilterToggle,
  onClearFilters,
}: SessionsFiltersMenuButtonProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleFilterDropdown
      label={t("sessions.filters")}
      activeCount={activeFilterCount}
      icon={SlidersHorizontal}
      clearLabel={t("sessions.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterCheckboxGroup
        label={t("sessions.filter.status")}
        options={statusOptions.map((statusOption) => ({
          value: statusOption,
          label: statusLabels[statusOption] ?? statusOption,
        }))}
        selected={filterStatus}
        onToggle={(value) => {
          try {
            onStatusFilterToggle(parseSessionStatus(value));
          } catch {
            // Ignore an unknown option; the contract rejects it if it reaches the server.
          }
        }}
      />

      <ModuleFilterDivider />

      <ModuleFilterCheckboxGroup
        label={t("sessions.filter.type")}
        options={typeOptions.map((typeOption) => ({
          value: typeOption,
          label: typeLabels[typeOption] ?? typeOption,
        }))}
        selected={filterType}
        onToggle={onTypeFilterToggle}
      />
    </ModuleFilterDropdown>
  );
}
