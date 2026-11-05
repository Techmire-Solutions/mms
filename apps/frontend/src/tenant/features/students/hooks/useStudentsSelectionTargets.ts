import { useMemo } from "react";
import type { Student } from "@mms/shared";
import {
  computeStudentsSelectionTargets,
  type StudentsSelectionTargets,
} from "@/tenant/features/students/hooks/studentsSelectionTargets";

export function useStudentsSelectionTargets({
  selectedIds,
  workStudents,
}: {
  selectedIds: string[];
  workStudents: Student[];
}): StudentsSelectionTargets {
  return useMemo(
    () => computeStudentsSelectionTargets({ selectedIds, workStudents }),
    [selectedIds, workStudents],
  );
}
