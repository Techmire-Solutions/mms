import React, { useMemo, type JSX } from "react";
import {
  CONTACTS_QUICK_FILTER_OPTIONS,
  isContactsQuickFilter,
  type ContactsQuickFilter,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { formatContactGenderLabel } from "@/lib/contacts/contactI18n";
import { GenderIcon } from "@/components/app/GenderIcon";
import {
  ModuleFilterDivider,
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/app/ModuleFiltersMenuButton";

export interface ContactsFiltersMenuButtonProps {
  activeFilterCount: number;
  quickFilter: ContactsQuickFilter;
  onQuickFilterChange: (preset: ContactsQuickFilter) => void;
  filterGender: string;
  genders: string[];
  onGenderChange: (gender: string) => void;
  sortField: string;
  sortOptions: Array<{ field: string; label: string }>;
  onSort: (field: string) => void;
  t: TranslationFunction;
}

export const ContactsFiltersMenuButton = React.memo(function ContactsFiltersMenuButton({
  activeFilterCount,
  quickFilter,
  onQuickFilterChange,
  filterGender,
  genders,
  onGenderChange,
  sortField,
  sortOptions,
  onSort,
  t,
}: ContactsFiltersMenuButtonProps): JSX.Element {
  const quickFilterOptions = useMemo(
    () =>
      CONTACTS_QUICK_FILTER_OPTIONS.map((preset) => ({
        value: preset.id,
        label: t(preset.labelKey),
      })),
    [t],
  );

  const genderOptions = useMemo(
    () => [
      { value: "all", label: t("contacts.allGenders") },
      ...genders.map((gender) => ({
        value: gender,
        label: formatContactGenderLabel(gender, t),
        icon: <GenderIcon gender={gender} className="w-3.5 h-3.5" aria-hidden="true" />,
      })),
    ],
    [genders, t],
  );

  const sortRadioOptions = useMemo(
    () =>
      sortOptions.map((opt) => ({
        value: opt.field,
        label: opt.label,
      })),
    [sortOptions],
  );

  return (
    <ModuleFilterDropdown label={t("contacts.filters")} activeCount={activeFilterCount}>
      <ModuleFilterRadioGroup
        label={t("contacts.filters")}
        value={quickFilter}
        onValueChange={(value) => {
          if (isContactsQuickFilter(value)) onQuickFilterChange(value);
        }}
        options={quickFilterOptions}
      />

      <ModuleFilterDivider />
      <ModuleFilterRadioGroup
        label={t("contacts.genderFilter")}
        value={filterGender || "all"}
        onValueChange={(value) => onGenderChange(value === "all" ? "" : value)}
        options={genderOptions}
      />

      <ModuleFilterDivider />
      <ModuleFilterRadioGroup
        label={t("contacts.sortBy")}
        value={sortField}
        onValueChange={onSort}
        options={sortRadioOptions}
      />
    </ModuleFilterDropdown>
  );
});
