/**
 * @file FacultyFiltersMenuPanel.tsx
 * @description Filter panel body for Faculty Work Filters menu.
 */
import {
  facultyFilterMenuValue,
  normalizeFacultyFilterValue,
} from "@/tenant/features/faculty/lib/facultyFilterValues";
import {
  isFacultyQuickFilter,
  FACULTY_QUICK_FILTER_OPTIONS,
  FACULTY_SORT_FIELD_SET,
  type FacultySortField,
  type FacultyQuickFilter,
} from "@mms/shared";
import {
  ModuleFilterCheckboxGroup,
  ModuleFilterDivider,
  ModuleFilterRadioGroup,
} from "@/components/app/ModuleFiltersMenuButton";
import { GenderIcon } from "@/components/app/GenderIcon";
import { formatContactGenderLabel } from "@/lib/contacts/contactI18n";
import { useTranslation } from "@/hooks/useTranslation";
import { facultyStatusLabel } from "@/lib/faculty/facultyStatusUi";
import type { FacultyFiltersMenuButtonProps } from "./FacultyFiltersMenuButton";

type PanelProps = Omit<FacultyFiltersMenuButtonProps, "activeFilterCount" | "onClearFilters">;

/** Inner filter groups rendered inside ModuleFilterDropdown. */
export function FacultyFiltersMenuPanel({
  filterStatus,
  filterSpecialization,
  filterGender,
  filterDepartment,
  filterDesignation,
  filterReportingFacultyId,
  departmentFilterOptions,
  designationFilterOptions,
  supervisorFilterOptions,
  quickFilter,
  onQuickFilterChange,
  genderFilters,
  statusOptions,
  specializationOptions,
  sortField,
  sortOptions,
  onToggleStatus,
  onSpecializationChange,
  onGenderChange,
  onDepartmentChange,
  onDesignationChange,
  onReportingFacultyChange,
  onSortChange,
}: PanelProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <ModuleFilterRadioGroup
        label={t("faculty.filters")}
        value={quickFilter}
        options={FACULTY_QUICK_FILTER_OPTIONS.map((option) => ({
          value: option.id,
          label: t(option.labelKey),
        }))}
        onValueChange={(value) => {
          if (isFacultyQuickFilter(value)) onQuickFilterChange(value);
        }}
      />

      <ModuleFilterDivider />

      <ModuleFilterCheckboxGroup
        label={t("faculty.filter.status")}
        options={statusOptions.map((status) => ({
          value: status,
          label: facultyStatusLabel(t, status),
        }))}
        selected={filterStatus}
        onToggle={onToggleStatus}
      />

      <ModuleFilterDivider />

      <ModuleFilterRadioGroup
        label={t("faculty.filter.gender")}
        value={facultyFilterMenuValue(filterGender)}
        options={[
          { value: "all", label: t("faculty.filter.allGenders") },
          ...genderFilters.map((gender) => ({
            value: gender,
            label: formatContactGenderLabel(gender, t),
            icon: <GenderIcon gender={gender} className="w-3.5 h-3.5" aria-hidden="true" />,
          })),
        ]}
        onValueChange={(value) => onGenderChange(normalizeFacultyFilterValue(value))}
      />

      {departmentFilterOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("faculty.filter.department")}
            value={facultyFilterMenuValue(filterDepartment)}
            options={[
              { value: "all", label: t("faculty.filter.allDepartments") },
              ...departmentFilterOptions,
            ]}
            onValueChange={(value) => onDepartmentChange(normalizeFacultyFilterValue(value))}
          />
        </>
      )}

      {designationFilterOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("faculty.filter.designation")}
            value={facultyFilterMenuValue(filterDesignation)}
            options={[
              { value: "all", label: t("faculty.filter.allDesignations") },
              ...designationFilterOptions,
            ]}
            onValueChange={(value) => onDesignationChange(normalizeFacultyFilterValue(value))}
          />
        </>
      )}

      {supervisorFilterOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("faculty.filter.supervisor")}
            value={facultyFilterMenuValue(filterReportingFacultyId)}
            options={[
              { value: "all", label: t("faculty.filter.allSupervisors") },
              ...supervisorFilterOptions,
            ]}
            onValueChange={(value) => onReportingFacultyChange(normalizeFacultyFilterValue(value))}
          />
        </>
      )}

      {specializationOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("faculty.filter.specialization")}
            value={facultyFilterMenuValue(filterSpecialization)}
            options={[
              { value: "all", label: t("faculty.filter.allSpecializations") },
              ...specializationOptions.map((specialization) => ({
                value: specialization,
                label: specialization,
              })),
            ]}
            onValueChange={(value) => onSpecializationChange(normalizeFacultyFilterValue(value))}
          />
        </>
      )}

      {sortOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("faculty.sortBy")}
            value={sortField}
            options={sortOptions.map((option) => ({
              value: option.field,
              label: option.label,
            }))}
            onValueChange={(field) => {
              if (FACULTY_SORT_FIELD_SET.has(field)) {
                onSortChange(field as FacultySortField);
              }
            }}
          />
        </>
      )}
    </>
  );
}

export type { FacultyQuickFilter };
