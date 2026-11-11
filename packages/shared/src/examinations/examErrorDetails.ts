/**
 * Structured `details` carried by examinations domain errors.
 *
 * Gate, lifecycle and optimistic-concurrency failures used to explain themselves only in the
 * message (up to five student ids, no ids at all for a transition). Clients had to parse prose to
 * show which students were blocked. These types are the machine-readable contract for
 * `HttpDomainError.details`, surfaced by `sendIfHttpDomainError` / `handleContractError` (and the
 * global error handler) without changing any status code.
 */

/** Rows attached to a gate error are capped so a large roster cannot bloat one error body. */
export const EXAM_ERROR_DETAILS_LIMIT = 100;

/** One student implicated by an eligibility/roster/marks-bound failure. */
export interface ExamGateStudentDetail {
  examId: string;
  studentId: string;
  /** Present for blocked/unknown attendance decisions. */
  attendancePct?: number | null;
  /** Present for blocked decisions (the required threshold). */
  requiredPct?: number | null;
  /** Present for the marks-bound failure. */
  marksObtained?: number;
  totalMarks?: number;
  state?: "blocked" | "unknown";
}

/** `details` for `exam_marks_out_of_range` / `exam_student_not_enrolled` / eligibility errors. */
export interface ExamEligibilityGateDetails {
  /** Set when the rejected batch covers exactly one exam (the common save path). */
  examId?: string;
  students: ExamGateStudentDetail[];
  counts: {
    outOfRange: number;
    notEnrolled: number;
    unknown: number;
    blocked: number;
  };
  /** True when `students` was cut at {@link EXAM_ERROR_DETAILS_LIMIT}. */
  truncated: boolean;
}

/** `details` for illegal transitions, publication locks and result-finalisation conflicts. */
export interface ExamLifecycleErrorDetails {
  examId?: string;
  examIds?: string[];
  /** Transition endpoints, when the rejection is a state move. */
  from?: string;
  to?: string;
}

/** `details` for an optimistic-concurrency (`stale_write`) rejection. */
export interface ExamStaleWriteDetails {
  examId?: string;
  studentId?: string;
  /** The token the caller supplied, when there was one. */
  version?: number;
}
