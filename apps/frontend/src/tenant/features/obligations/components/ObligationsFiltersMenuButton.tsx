import type { JSX } from "react";
import { Filter } from "lucide-react";
import {
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/app/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import type { ObligationType } from "@/lib/data/obligationsData";

interface ObligationsFiltersMenuButtonProps {
  typeFilter: string;
  obligationTypes: ObligationType[];
  activeFilterCount: number;
  onChangeType: (value: string) => void;
  onClearFilters: () => void;
}

/** Obligations Work single Filters menu — obligation type radio group on shared chrome. */
export function ObligationsFiltersMenuButton({
  typeFilter,
  obligationTypes,
  activeFilterCount,
  onChangeType,
  onClearFilters,
}: ObligationsFiltersMenuButtonProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleFilterDropdown
      label={t("obligations.filters")}
      activeCount={activeFilterCount}
      icon={Filter}
      clearLabel={t("obligations.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterRadioGroup
        label={t("obligations.filter.type")}
        options={[
          { value: "all", label: t("obligations.filter.allTypes") },
          ...obligationTypes.map((item) => ({ value: item.id, label: item.name })),
        ]}
        value={typeFilter}
        onValueChange={onChangeType}
      />
    </ModuleFilterDropdown>
  );
}
