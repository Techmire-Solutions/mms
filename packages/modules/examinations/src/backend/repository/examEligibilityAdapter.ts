import type { ExamEligibilityRepository } from "./examEligibilityPort.js";
import {
  grantEligibilityOverride,
  revokeEligibilityOverride,
  listActiveOverrides,
  loadExamEligibility,
  loadExamEligibilityBatch,
  loadExamRoster,
  loadExamStudentSections,
  setExamAttendanceGate,
} from "../repository/examEligibilityRepository.js";
import {
  countExamResultsForExam,
  findExamLifecycleState,
  findOwningSessionStatuses,
  setExamResultsFinalized,
} from "../repository/examClassMembershipRepository.js";

/** Drizzle-backed adapter for {@link ExamEligibilityRepository}. */
export const examEligibilityRepository: ExamEligibilityRepository = {
  loadExamEligibility,
  loadExamEligibilityBatch,
  loadExamRoster,
  loadExamStudentSections,
  setExamAttendanceGate,
  grantEligibilityOverride,
  revokeEligibilityOverride,
  listActiveOverrides,
  findExamLifecycleState,
  countExamResultsForExam,
  findOwningSessionStatuses,
  setExamResultsFinalized,
};
