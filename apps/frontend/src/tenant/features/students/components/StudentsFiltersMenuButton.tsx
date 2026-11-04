import { SlidersHorizontal } from "lucide-react";
import {
  STUDENTS_QUICK_FILTER_OPTIONS,
  isStudentsQuickFilter,
  type StudentsQuickFilter,
} from "@mms/shared";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDivider,
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/app/ModuleFiltersMenuButton";
import { GenderIcon } from "@/components/app/GenderIcon";
import { formatContactGenderLabel } from "@/lib/contacts/contactI18n";
import { studentStatusLabel } from "@/lib/students/studentStatusUi";
import { useTranslation } from "@/hooks/useTranslation";
import type { StudentsListContentSortField } from "@/tenant/features/students/lib/studentsListTypes";

/**
 * Maps the sort radio value onto the directory sort field.
 * `"none"` clears the sort (`null`) instead of silently switching to name ordering.
 */
export function resolveStudentsSortSelection(value: string): StudentsListContentSortField | null {
  return value === "none" ? null : (value as StudentsListContentSortField);
}

/**
 * Radio value for the gender group: "no filter" is stored as `""` but the menu's first
 * option is the `all` sentinel, so the default must render as selected (M1).
 */
export function resolveStudentsGenderSelection(gender: string): string {
  return gender || "all";
}

export interface StudentsFiltersMenuButtonProps {
  studentFilterStatus: string[];
  studentFilterGender: string;
  quickFilter: StudentsQuickFilter;
  onQuickFilterChange: (preset: string) => void;
  studentStatusOptions: readonly string[];
  genderFilters: string[];
  isStatusEnabled?: boolean;
  isGenderEnabled?: boolean;
  activeFilterCount: number;
  sortField: StudentsListContentSortField | null;
  sortOptions: Array<{ field: StudentsListContentSortField; label: string }>;
  onToggleStatus: (status: string) => void;
  onGenderChange: (value: string) => void;
  onSortChange: (field: StudentsListContentSortField | null) => void;
  onClearFilters: () => void;
}

export function StudentsFiltersMenuButton({
  studentFilterStatus,
  studentFilterGender,
  quickFilter,
  onQuickFilterChange,
  studentStatusOptions,
  genderFilters,
  isStatusEnabled = true,
  isGenderEnabled = true,
  activeFilterCount,
  sortField,
  sortOptions,
  onToggleStatus,
  onGenderChange,
  onSortChange,
  onClearFilters,
}: StudentsFiltersMenuButtonProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleFilterDropdown
      label={t("students.filters")}
      activeCount={activeFilterCount}
      icon={SlidersHorizontal}
      clearLabel={t("students.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterRadioGroup
        label={t("students.filters")}
        value={quickFilter}
        options={STUDENTS_QUICK_FILTER_OPTIONS.map((option) => ({
          value: option.id,
          label: t(option.labelKey),
        }))}
        onValueChange={(value) => {
          if (isStudentsQuickFilter(value)) onQuickFilterChange(value);
        }}
      />

      {isStatusEnabled && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterCheckboxGroup
            label={t("students.filterByStatus")}
            options={studentStatusOptions.map((status) => ({
              value: status,
              label: studentStatusLabel(t, status),
            }))}
            selected={studentFilterStatus}
            onToggle={onToggleStatus}
          />
        </>
      )}

      {isGenderEnabled && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("students.gender")}
            value={resolveStudentsGenderSelection(studentFilterGender)}
            options={[
              { value: "all", label: t("students.allGenders") },
              ...genderFilters.map((gender) => ({
                value: gender,
                label: formatContactGenderLabel(gender, t),
                icon: <GenderIcon gender={gender} className="w-3.5 h-3.5" aria-hidden="true" />,
              })),
            ]}
            onValueChange={onGenderChange}
          />
        </>
      )}

      {sortOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("students.sortBy")}
            value={sortField ?? "none"}
            options={[
              { value: "none", label: t("common.none") },
              ...sortOptions.map((sortOption) => ({
                value: sortOption.field,
                label: sortOption.label,
              })),
            ]}
            onValueChange={(val: string) => {
              onSortChange(resolveStudentsSortSelection(val));
            }}
          />
        </>
      )}
    </ModuleFilterDropdown>
  );
}
