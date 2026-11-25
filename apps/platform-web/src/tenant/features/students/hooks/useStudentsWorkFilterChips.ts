import { useCallback, useMemo } from "react";
import { useDescriptorFilterChips } from "@mms/fe-core/lib/useDescriptorFilterChips";
import { useStudentEntityDescriptor } from "@/tenant/features/students/hooks/useStudentEntityDescriptor";

export interface UseStudentsWorkFilterChipsParams {
  studentFilterStatus: string[];
  studentFilterGender: string;
  onToggleStatus: (status: string) => void;
  onGenderChange: (gender: string) => void;
}

/** Resolves filter chips for the Students Work tier from entity descriptor and active filters. */
export function useStudentsWorkFilterChips({
  studentFilterStatus,
  studentFilterGender,
  onToggleStatus,
  onGenderChange,
}: UseStudentsWorkFilterChipsParams) {
  const descriptor = useStudentEntityDescriptor();

  const activeFilters = useMemo(
    () => ({
      status: studentFilterStatus.length > 0 ? studentFilterStatus : undefined,
      gender: studentFilterGender || undefined,
    }),
    [studentFilterStatus, studentFilterGender],
  );

  const onRemoveChip = useCallback(
    (fieldKey: string, value?: string) => {
      if (fieldKey === "status" && value) {
        onToggleStatus(value);
        return;
      }
      if (fieldKey === "gender") onGenderChange("");
    },
    [onToggleStatus, onGenderChange],
  );

  return useDescriptorFilterChips(descriptor, activeFilters, onRemoveChip);
}
