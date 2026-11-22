import type { Dispatch, SetStateAction } from "react";
import type { Exam } from "@mms/shared";
import { useWorkSelection } from "@/hooks/useWorkSelection";

/**
 * Work directory row selection SSOT for Examinations (Question Bank-shaped).
 * Thin facade over the sanctioned `useWorkSelection` shared hook — no local
 * re-implementation of select-all/toggle/clear semantics.
 */
export function useExamSelection(exams: Exam[]) {
  const selection = useWorkSelection<string>(exams);

  return {
    selectedIds: selection.selectedIds,
    setSelectedIds: selection.setSelectedIds,
    allVisibleSelected: selection.allVisibleSelected,
    someVisibleSelected: selection.someVisibleSelected,
    toggleSelectAll: (checked: boolean) => selection.toggleSelectAll(checked),
    toggleSelectedExam: selection.toggleSelected,
    clearSelection: selection.clearSelection,
  };
}

export type ExamSelection = ReturnType<typeof useExamSelection>;
export type { Dispatch, SetStateAction };
