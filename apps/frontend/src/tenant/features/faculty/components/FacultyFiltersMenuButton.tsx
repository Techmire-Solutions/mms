/**
 * @file FacultyFiltersMenuButton.tsx
 * @description Faculty Work Filters dropdown shell.
 */
import { SlidersHorizontal } from "lucide-react";
import type { FacultySortField, FacultyQuickFilter } from "@mms/shared";
import { ModuleFilterDropdown } from "@/components/ui/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import { FacultyFiltersMenuPanel } from "./FacultyFiltersMenuPanel";

export interface FacultyFiltersMenuButtonProps {
  filterStatus: string[];
  filterSpecialization: string;
  filterGender: string;
  filterDepartment: string;
  filterDesignation: string;
  filterReportingFacultyId: string;
  departmentFilterOptions: Array<{ value: string; label: string }>;
  designationFilterOptions: Array<{ value: string; label: string }>;
  supervisorFilterOptions: Array<{ value: string; label: string }>;
  quickFilter: FacultyQuickFilter;
  onQuickFilterChange: (preset: string) => void;
  genderFilters: string[];
  statusOptions: string[];
  specializationOptions: string[];
  activeFilterCount: number;
  sortField: FacultySortField;
  sortOptions: Array<{ field: FacultySortField; label: string }>;
  onToggleStatus: (status: string) => void;
  onSpecializationChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onDesignationChange: (value: string) => void;
  onReportingFacultyChange: (value: string) => void;
  onSortChange: (field: FacultySortField) => void;
  onClearFilters: () => void;
}

/** Faculty Work single Filters menu — Contacts/Students-shaped quick filter + status + specialization + gender + sort. */
export function FacultyFiltersMenuButton(props: FacultyFiltersMenuButtonProps): React.JSX.Element {
  const { t } = useTranslation();
  const { activeFilterCount, onClearFilters, ...panelProps } = props;

  return (
    <ModuleFilterDropdown
      label={t("faculty.filters")}
      activeCount={activeFilterCount}
      icon={SlidersHorizontal}
      clearLabel={t("faculty.clearFilters")}
      onClear={onClearFilters}
    >
      <FacultyFiltersMenuPanel {...panelProps} />
    </ModuleFilterDropdown>
  );
}
