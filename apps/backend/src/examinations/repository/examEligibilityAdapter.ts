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
} from "../../db/repositories/examEligibilityRepository.js";
import {
  countExamResultsForExam,
  findExamLifecycleState,
  findOwningSessionStatuses,
  setExamResultsFinalized,
} from "../../db/repositories/examClassMembershipRepository.js";

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
