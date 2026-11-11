type EligibilityStore = typeof import("../../db/repositories/examEligibilityRepository.js");
type MembershipStore = typeof import("../../db/repositories/examClassMembershipRepository.js");

export type {
  ExamEligibilityRow,
  ExamEligibilityView,
} from "../../db/repositories/examEligibilityRepository.js";
export type { ExamLifecycleState } from "../../db/repositories/examClassMembershipRepository.js";
export type {
  ExamRosterEntry,
  ExamStudentSection,
} from "../../db/repositories/examEligibilityRepository.js";

/**
 * Port for exam attendance eligibility, overrides and results finalisation, so the examination use
 * cases never import `db/repositories` directly (SYSTEM_ARCHITECTURE.md §5).
 */
export interface ExamEligibilityRepository {
  loadExamEligibility: EligibilityStore["loadExamEligibility"];
  setExamAttendanceGate: EligibilityStore["setExamAttendanceGate"];
  grantEligibilityOverride: EligibilityStore["grantEligibilityOverride"];
  revokeEligibilityOverride: EligibilityStore["revokeEligibilityOverride"];
  listActiveOverrides: EligibilityStore["listActiveOverrides"];
  loadExamEligibilityBatch: EligibilityStore["loadExamEligibilityBatch"];
  loadExamStudentSections: EligibilityStore["loadExamStudentSections"];
  loadExamRoster: EligibilityStore["loadExamRoster"];
  findExamLifecycleState: MembershipStore["findExamLifecycleState"];
  countExamResultsForExam: MembershipStore["countExamResultsForExam"];
  findOwningSessionStatuses: MembershipStore["findOwningSessionStatuses"];
  setExamResultsFinalized: MembershipStore["setExamResultsFinalized"];
}
