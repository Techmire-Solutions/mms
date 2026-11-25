type EligibilityStore = typeof import("../repository/examEligibilityRepository.js");
type MembershipStore = typeof import("../repository/examClassMembershipRepository.js");

export type {
  ExamEligibilityRow,
  ExamEligibilityView,
} from "../repository/examEligibilityRepository.js";
export type { ExamLifecycleState } from "../repository/examClassMembershipRepository.js";
export type {
  ExamRosterEntry,
  ExamStudentSection,
} from "../repository/examEligibilityRepository.js";

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
