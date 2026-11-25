import type { Class } from "@mms/contracts";
import { isCapacityFull } from "./enrollmentCapacity";
import type { SectionPlacement } from "../components/wizard/Step4SectionPlacement";

export interface EnrollmentWizardProceedInput {
  step: number;
  hasStudent: boolean;
  hasSession: boolean;
  /** Precomputed eligibility for the selected student/session (step 2). */
  eligibilityPassed: boolean;
  classInfo: Class | null;
  placement: SectionPlacement;
  feeReady: boolean;
}

/** Whether the wizard may advance from the current step. */
export function canProceedEnrollmentStep({
  step,
  hasStudent,
  hasSession,
  eligibilityPassed,
  classInfo,
  placement,
  feeReady,
}: EnrollmentWizardProceedInput): boolean {
  if (step === 0) return hasStudent;
  if (step === 1) return hasSession;
  if (step === 2) return eligibilityPassed;
  if (step === 3) {
    if (!classInfo) return false;
    const sections = classInfo.sections ?? [];
    if (sections.length > 0) {
      const selectedSection = sections.find((section) => section.id === placement.sectionId);
      if (!selectedSection) return false;
      if (isCapacityFull(selectedSection.enrolled, selectedSection.capacity)) return false;
    }
    return true;
  }
  if (step === 4) return feeReady;
  return true;
}
