import { useCallback, useMemo } from "react";
import { useDescriptorFilterChips } from "@/components/common/useDescriptorFilterChips";
import { computeFacultySelectionTargets } from "@/tenant/features/faculty/hooks/facultySelectionTargets";
import { useFacultyEntityDescriptor } from "@/tenant/features/faculty/hooks/useFacultyEntityDescriptor";
import { useFacultyStatusConfig } from "@/tenant/features/faculty/hooks/useFacultyStatusConfig";
import type { Faculty, FacultySortField } from "@mms/shared";
import type { FilterChip } from "@/components/app/FilterChips";

export interface UseFacultyWorkTierActionsProps {
  filterStatus: string[];
  filterSpecialization: string;
  filterGender: string;
  filterDepartment: string;
  filterDesignation: string;
  filterReportingFacultyId: string;
  supervisorFilterOptions: Array<{ value: string; label: string }>;
  onToggleStatus: (status: string) => void;
  onSpecializationChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onDesignationChange: (value: string) => void;
  onReportingFacultyChange: (value: string) => void;
  sortField: FacultySortField;
  sortDir: "asc" | "desc";
  onSortChange: (field: FacultySortField, dir: "asc" | "desc") => void;
  selectedIds: string[];
  faculty?: Faculty[];
  onBulkStatusChange?: (ids: string[], status: string) => void | Promise<void>;
  onBulkSpecializationChange?: (ids: string[], specialization: string) => void | Promise<void>;
  onClearSelection: () => void;
}

export interface UseFacultyWorkTierActionsReturn {
  filterChips: FilterChip[];
  statusConfig: ReturnType<typeof useFacultyStatusConfig>;
  selectionTargets: ReturnType<typeof computeFacultySelectionTargets>;
  handleBulkStatusChange: (status: string) => Promise<void>;
  handleBulkSpecializationChange: (specialization: string) => Promise<void>;
  handleSortFieldChange: (field: FacultySortField) => void;
}

export function useFacultyWorkTierActions(
  props: UseFacultyWorkTierActionsProps,
): UseFacultyWorkTierActionsReturn {
  const {
    filterStatus,
    filterSpecialization,
    filterGender,
    filterDepartment,
    filterDesignation,
    filterReportingFacultyId,
    supervisorFilterOptions,
    onToggleStatus,
    onSpecializationChange,
    onGenderChange,
    onDepartmentChange,
    onDesignationChange,
    onReportingFacultyChange,
    sortField,
    sortDir,
    onSortChange,
    selectedIds,
    onBulkStatusChange,
    onBulkSpecializationChange,
    onClearSelection,
  } = props;

  const descriptor = useFacultyEntityDescriptor();

  const supervisorFilterLabel = useMemo(() => {
    if (!filterReportingFacultyId) return "";
    return (
      supervisorFilterOptions.find((option) => option.value === filterReportingFacultyId)?.label ??
      filterReportingFacultyId
    );
  }, [filterReportingFacultyId, supervisorFilterOptions]);

  const activeFilters = useMemo(
    () => ({
      status: filterStatus.length > 0 ? filterStatus : undefined,
      specialization:
        filterSpecialization && filterSpecialization !== "all" ? filterSpecialization : undefined,
      gender: filterGender && filterGender !== "all" ? filterGender : undefined,
      department: filterDepartment || undefined,
      designation: filterDesignation || undefined,
      reportingFacultyName: supervisorFilterLabel || undefined,
    }),
    [
      filterStatus,
      filterSpecialization,
      filterGender,
      filterDepartment,
      filterDesignation,
      supervisorFilterLabel,
    ],
  );

  const onRemoveChip = useCallback(
    (fieldKey: string, value?: string) => {
      if (fieldKey === "status" && value) {
        onToggleStatus(value);
        return;
      }
      if (fieldKey === "specialization") onSpecializationChange("");
      if (fieldKey === "gender") onGenderChange("");
      if (fieldKey === "department") onDepartmentChange("");
      if (fieldKey === "designation") onDesignationChange("");
      if (fieldKey === "reportingFacultyName") onReportingFacultyChange("");
    },
    [
      onToggleStatus,
      onSpecializationChange,
      onGenderChange,
      onDepartmentChange,
      onDesignationChange,
      onReportingFacultyChange,
    ],
  );

  const filterChips = useDescriptorFilterChips(descriptor, activeFilters, onRemoveChip);

  const statusConfig = useFacultyStatusConfig();

  const handleBulkStatusChange = useCallback(
    async (status: string): Promise<void> => {
      try {
        await onBulkStatusChange?.(selectedIds, status);
        onClearSelection();
      } catch {
        // Toast already emitted by the crud action; keep selection for retry.
      }
    },
    [onBulkStatusChange, selectedIds, onClearSelection],
  );

  const handleBulkSpecializationChange = useCallback(
    async (specialization: string): Promise<void> => {
      try {
        await onBulkSpecializationChange?.(selectedIds, specialization);
        onClearSelection();
      } catch {
        // Toast already emitted by the crud action; keep selection for retry.
      }
    },
    [onBulkSpecializationChange, selectedIds, onClearSelection],
  );

  const handleSortFieldChange = useCallback(
    (field: FacultySortField): void => {
      if (field === sortField) {
        onSortChange(field, sortDir === "asc" ? "desc" : "asc");
      } else {
        onSortChange(field, "asc");
      }
    },
    [sortField, sortDir, onSortChange],
  );

  const members = useMemo(() => props.faculty ?? [], [props.faculty]);
  const selectionTargets = useMemo(
    () =>
      computeFacultySelectionTargets({
        selectedIds,
        workFaculty: members,
      }),
    [selectedIds, members],
  );

  return {
    filterChips,
    statusConfig,
    selectionTargets,
    handleBulkStatusChange,
    handleBulkSpecializationChange,
    handleSortFieldChange,
  };
}
