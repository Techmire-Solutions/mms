import { useState, useCallback } from "react";
import type { FacultyMember } from "@mms/shared";
import type { Class } from "@/lib/data/sessionsData";
import { EMPTY_CLASS } from "./classDetailDraftDefaults";
import { useClassDetailAcademicDraft } from "./useClassDetailAcademicDraft";
import { useClassDetailFinancialDraft } from "./useClassDetailFinancialDraft";

export { EMPTY_CLASS } from "./classDetailDraftDefaults";

export interface UseClassDetailDraftOptions {
  open: boolean;
  sessionClass: Class | null;
  allFaculty: FacultyMember[];
}

export function useClassDetailDraft({
  open,
  sessionClass,
  allFaculty,
}: UseClassDetailDraftOptions) {
  const [classDraft, setClassDraft] = useState<Class>(() =>
    sessionClass ? { ...sessionClass } : { ...EMPTY_CLASS, id: crypto.randomUUID() },
  );

  // Re-seed the draft from the class being edited on every (re)open (render-phase reset).
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevSessionClass, setPrevSessionClass] = useState(sessionClass);
  if (prevOpen !== open || prevSessionClass !== sessionClass) {
    setPrevOpen(open);
    setPrevSessionClass(sessionClass);
    if (open) {
      setClassDraft(
        sessionClass ? { ...sessionClass } : { ...EMPTY_CLASS, id: crypto.randomUUID() },
      );
    }
  }

  const updateDraft = useCallback(<K extends keyof Class>(field: K, value: Class[K]) => {
    setClassDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const financial = useClassDetailFinancialDraft(setClassDraft);
  const academic = useClassDetailAcademicDraft(classDraft, setClassDraft, allFaculty);

  return {
    classDraft,
    setClassDraft,
    updateDraft,
    // Fees
    addFeeRow: financial.addFeeRow,
    removeFeeRow: financial.removeFeeRow,
    updateFeeRow: financial.updateFeeRow,
    // Discounts
    addDiscountRow: financial.addDiscountRow,
    removeDiscountRow: financial.removeDiscountRow,
    updateDiscountRow: financial.updateDiscountRow,
    // Schedules & Timetables
    addScheduleRow: academic.addScheduleRow,
    removeScheduleRow: academic.removeScheduleRow,
    updateScheduleRow: academic.updateScheduleRow,
    activeTimetable: academic.activeTimetable,
    addPeriodRow: academic.addPeriodRow,
    removePeriodRow: academic.removePeriodRow,
    updatePeriodRow: academic.updatePeriodRow,
    // Budgets & Refreshments
    addBudgetRow: financial.addBudgetRow,
    removeBudgetRow: financial.removeBudgetRow,
    updateBudgetRow: financial.updateBudgetRow,
    addRefreshmentRow: financial.addRefreshmentRow,
    removeRefreshmentRow: financial.removeRefreshmentRow,
    updateRefreshmentRow: financial.updateRefreshmentRow,
    // Scholarships
    activeScholarship: academic.activeScholarship,
    updateScholarship: academic.updateScholarship,
    updateEligibility: academic.updateEligibility,
  };
}
