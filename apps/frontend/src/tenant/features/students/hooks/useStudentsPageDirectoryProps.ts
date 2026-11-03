import { useMemo } from "react";
import type { Student } from "@mms/shared";
import { getDirectoryPageSelection } from "@/lib/directorySelection";

/** Builds page-bound selection flags for Students table/cards (Contacts-shaped). */
export function useStudentsPageDirectoryProps({
  workStudents,
  selectedIds,
}: {
  workStudents: Student[];
  selectedIds: string[];
}) {
  return useMemo(() => {
    const pageIds = workStudents.map((student) => String(student.id));
    const pageSelection = getDirectoryPageSelection(pageIds, selectedIds);
    return {
      allSelected: pageSelection.allSelected,
      someSelected: pageSelection.someSelected,
    };
  }, [selectedIds, workStudents]);
}
