import React from "react";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDivider,
  ModuleFilterDropdown,
} from "@/components/app/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import type { DataTableFilter, DataTableFilterSelection } from "./dataTableTypes";

export interface DataTableFiltersMenuProps<TData> {
  filters: readonly DataTableFilter<TData>[];
  selection: DataTableFilterSelection;
  activeCount: number;
  onToggle: (filterId: string, value: string) => void;
  onClear: () => void;
}

/** Facet filter menu built from {@link DataTableFilter} definitions. */
export function DataTableFiltersMenu<TData>({
  filters,
  selection,
  activeCount,
  onToggle,
  onClear,
}: DataTableFiltersMenuProps<TData>): React.JSX.Element | null {
  const { t } = useTranslation();
  const facets = filters.filter((filter) => filter.options.length > 0);
  if (facets.length === 0) return null;

  return (
    <ModuleFilterDropdown
      label={t("common.filters")}
      activeCount={activeCount}
      clearLabel={t("common.clearFilters")}
      onClear={onClear}
    >
      {facets.map((filter, index) => (
        <React.Fragment key={filter.id}>
          {index > 0 ? <ModuleFilterDivider /> : null}
          <ModuleFilterCheckboxGroup
            label={filter.label}
            options={filter.options}
            selected={[...(selection[filter.id] ?? [])]}
            onToggle={(value) => onToggle(filter.id, value)}
          />
        </React.Fragment>
      ))}
    </ModuleFilterDropdown>
  );
}
