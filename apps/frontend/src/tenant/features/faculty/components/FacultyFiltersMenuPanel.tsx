/**
 * @file FacultyFiltersMenuPanel.tsx
 * @description Filter panel body for Faculty Work Filters menu.
 */
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
} from "@/components/ui/ModuleFiltersMenuButton";
import { GenderIcon } from "@/components/ui/GenderIcon";
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
        value={filterGender}
        options={[
          { value: "all", label: t("faculty.filter.allGenders") },
          ...genderFilters.map((gender) => ({
            value: gender,
            label: formatContactGenderLabel(gender, t),
            icon: <GenderIcon gender={gender} className="w-3.5 h-3.5" aria-hidden="true" />,
          })),
        ]}
        onValueChange={onGenderChange}
      />

      {departmentFilterOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("faculty.filter.department")}
            value={filterDepartment || "all"}
            options={[
              { value: "all", label: t("faculty.filter.allDepartments") },
              ...departmentFilterOptions,
            ]}
            onValueChange={(value) => onDepartmentChange(value === "all" ? "" : value)}
          />
        </>
      )}

      {designationFilterOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("faculty.filter.designation")}
            value={filterDesignation || "all"}
            options={[
              { value: "all", label: t("faculty.filter.allDesignations") },
              ...designationFilterOptions,
            ]}
            onValueChange={(value) => onDesignationChange(value === "all" ? "" : value)}
          />
        </>
      )}

      {supervisorFilterOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("faculty.filter.supervisor")}
            value={filterReportingFacultyId || "all"}
            options={[
              { value: "all", label: t("faculty.filter.allSupervisors") },
              ...supervisorFilterOptions,
            ]}
            onValueChange={(value) => onReportingFacultyChange(value === "all" ? "" : value)}
          />
        </>
      )}

      {specializationOptions.length > 0 && (
        <>
          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("faculty.filter.specialization")}
            value={filterSpecialization}
            options={[
              { value: "all", label: t("faculty.filter.allSpecializations") },
              ...specializationOptions.map((specialization) => ({
                value: specialization,
                label: specialization,
              })),
            ]}
            onValueChange={onSpecializationChange}
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
