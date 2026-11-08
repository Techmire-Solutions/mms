import type { ExamEligibilityRepository } from "./examEligibilityPort.js";
import {
  grantEligibilityOverride,
  listActiveOverrides,
  loadExamEligibility,
  setExamAttendanceGate,
} from "../../db/repositories/examEligibilityRepository.js";
import {
  findExamClassIds,
  listEnrolledStudentIds,
  setExamResultsFinalized,
} from "../../db/repositories/examClassMembershipRepository.js";

/** Drizzle-backed adapter for {@link ExamEligibilityRepository}. */
export const examEligibilityRepository: ExamEligibilityRepository = {
  loadExamEligibility,
  setExamAttendanceGate,
  grantEligibilityOverride,
  listActiveOverrides,
  findExamClassIds,
  listEnrolledStudentIds,
  setExamResultsFinalized,
};
