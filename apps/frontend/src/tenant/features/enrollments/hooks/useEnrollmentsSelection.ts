import { useState, type Dispatch, type SetStateAction } from "react";
import type { Enrollment } from "@/lib/data/enrollmentData";

/** Work directory row selection SSOT for Enrollments (Sessions-shaped). */
export function useEnrollmentsSelection(enrollments: Enrollment[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    enrollments.length > 0 &&
    enrollments.every((enrollmentItem) => selectedSet.has(enrollmentItem.id));
  const someVisibleSelected =
    selectedSet.size > 0 &&
    enrollments.some((enrollmentItem) => selectedSet.has(enrollmentItem.id));

  const toggleSelectAll = (checked: boolean) => {
    const visibleIds = enrollments.map((enrollmentItem) => enrollmentItem.id);
    const visibleSet = new Set(visibleIds);
    setSelectedIds((currentIds) =>
      checked
        ? [...new Set([...currentIds, ...visibleIds])]
        : currentIds.filter((id) => !visibleSet.has(id)),
    );
  };

  const toggleSelectedEnrollment = (id: string, checked: boolean) => {
    setSelectedIds((currentIds) =>
      checked ? [...currentIds, id] : currentIds.filter((selectedId) => selectedId !== id),
    );
  };

  const clearSelection = () => setSelectedIds([]);

  return {
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelectedEnrollment,
    clearSelection,
  };
}

export type EnrollmentsSelection = ReturnType<typeof useEnrollmentsSelection>;
export type { Dispatch, SetStateAction };
