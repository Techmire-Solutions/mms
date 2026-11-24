import { z } from "zod";
import { normalizeSessionStatus } from "./sessionTransitions.js";

/** Outcome stored on an enrollment once completion is evaluated. */
export const ENROLLMENT_COMPLETION_STATUSES = ["completed", "not_completed"] as const;
export type EnrollmentCompletionStatus = (typeof ENROLLMENT_COMPLETION_STATUSES)[number];

/** Why an enrollment did not meet its session's completion criteria. */
export const COMPLETION_SHORTFALLS = [
  "attendance_below",
  "attendance_unknown",
  "exam_not_passed",
  "exam_missing",
] as const;
export type CompletionShortfall = (typeof COMPLETION_SHORTFALLS)[number];

/** Session completion criteria (short courses); null minimum = attendance not required. */
export interface SessionCompletionCriteria {
  minAttendancePct?: number | null;
  requiresExamPass?: boolean | null;
}

/** Facts gathered for one enrollment (null = nothing to measure yet). */
export interface CompletionFacts {
  /** Present-or-late share of countable (instructional, non-leave) days, 0–100. */
  attendancePct: number | null;
  /** True when every exam of the class has a passing result; null when the class has no exams. */
  examsPassed: boolean | null;
  /** False when some exam of the class has no result for the student. */
  examsComplete: boolean;
}

/** Completion rule: every configured criterion must hold. */
export function evaluateCompletion(
  facts: CompletionFacts,
  criteria: SessionCompletionCriteria,
): { status: EnrollmentCompletionStatus; shortfalls: CompletionShortfall[] } {
  const shortfalls: CompletionShortfall[] = [];
  const minimum = criteria.minAttendancePct ?? null;
  if (minimum !== null && minimum > 0) {
    if (facts.attendancePct === null) shortfalls.push("attendance_unknown");
    else if (facts.attendancePct < minimum) shortfalls.push("attendance_below");
  }
  if (criteria.requiresExamPass) {
    if (facts.examsPassed === null || !facts.examsComplete) shortfalls.push("exam_missing");
    else if (!facts.examsPassed) shortfalls.push("exam_not_passed");
  }
  return { status: shortfalls.length === 0 ? "completed" : "not_completed", shortfalls };
}

/** Reasons a completion workflow may not finalise yet (completion gates). */
export const COMPLETION_GATE_VIOLATIONS = [
  "attendance_unfinalized",
  "exams_unfinalized",
  "no_criteria",
  "outstanding_dues",
  "evaluation_stale",
  "session_not_ended",
] as const;
export type CompletionGateViolation = (typeof COMPLETION_GATE_VIOLATIONS)[number];

export interface CompletionGateInput {
  /** Instructional days before the session end that have no attendance row. */
  unmarkedDays?: number;
  /** Exams of the session's classes that are not completed/finalised. */
  unfinalizedExams?: number;
  /** Whether the session has at least one completion criterion. */
  criteriaConfigured?: boolean;
  /** Outstanding amount across the enrolled invoices (minor units handled by callers). */
  outstandingDues?: number;
  /** Evidence changed after the last evaluation. */
  evaluationStale?: boolean;
}

/** Gate table used by the use-case before evaluating completion or issuing certificates. */
export function completionGateViolations(input: CompletionGateInput): CompletionGateViolation[] {
  const violations: CompletionGateViolation[] = [];
  if ((input.unmarkedDays ?? 0) > 0) violations.push("attendance_unfinalized");
  if ((input.unfinalizedExams ?? 0) > 0) violations.push("exams_unfinalized");
  if (input.criteriaConfigured === false) violations.push("no_criteria");
  if ((input.outstandingDues ?? 0) > 0) violations.push("outstanding_dues");
  if (input.evaluationStale) violations.push("evaluation_stale");
  return violations;
}

export interface CompletionWindowInput {
  status: string;
  endDate?: string | null;
  /** Workspace business day (`YYYY-MM-DD`). */
  today: string;
}

const sessionEnded = (input: CompletionWindowInput): boolean => {
  const end = (input.endDate ?? "").slice(0, 10);
  return Boolean(end) && end <= input.today;
};

/**
 * Completion may be evaluated once the session is `completed`, or on its last day/after it while
 * still `in_progress`. Evaluating a live session marks every enrollment with the current (partial)
 * attendance/exam facts, so an early run must not be possible.
 */
export function canEvaluateSessionCompletion(input: CompletionWindowInput): boolean {
  const state = normalizeSessionStatus(input.status);
  if (state === "completed") return true;
  if (state === "in_progress") return sessionEnded(input);
  return false;
}

/** Certificates are final: the session must be completed and its end date must have passed. */
export function canIssueSessionCertificates(input: CompletionWindowInput): boolean {
  return normalizeSessionStatus(input.status) === "completed" && sessionEnded(input);
}

export const sessionCompletionRowSchema = z
  .object({
    enrollmentId: z.string(),
    studentId: z.string(),
    studentName: z.string(),
    className: z.string(),
    attendancePct: z.number().nullable(),
    examsPassed: z.boolean().nullable(),
    status: z.enum(ENROLLMENT_COMPLETION_STATUSES),
    shortfalls: z.array(z.enum(COMPLETION_SHORTFALLS)),
    completedAt: z.string().nullable(),
    certificateIssuedAt: z.string().nullable(),
    /** Instructional days without a marked attendance row (completion gate). */
    unmarkedDays: z.number().int().nonnegative().default(0),
    /** Exams of this enrollment's class that are not completed/finalised. */
    unfinalizedExams: z.number().int().nonnegative().default(0),
    /** Outstanding amount on this enrollment's invoices. */
    outstandingDues: z.number().nonnegative().default(0),
    /** Evidence changed after the last evaluation. */
    stale: z.boolean().default(false),
  })
  .strict();
export type SessionCompletionRow = z.infer<typeof sessionCompletionRowSchema>;

/** Optional acknowledgements for a completion gate (server still requires the override permission). */
const completionAcknowledgements = {
  acknowledge: z
    .array(z.enum(COMPLETION_GATE_VIOLATIONS))
    .max(COMPLETION_GATE_VIOLATIONS.length)
    .optional(),
  reason: z.string().trim().min(3).max(500).optional(),
};

/** Evaluate request: acknowledge finalisation gaps explicitly (audited). */
export const sessionCompletionActionBodySchema = z
  .object({
    ...completionAcknowledgements,
    /** Sessions without criteria complete everyone; this acknowledges that policy explicitly. */
    allowNoCriteria: z.boolean().optional(),
  })
  .strict();
export type SessionCompletionActionBody = z.infer<typeof sessionCompletionActionBodySchema>;

/** Issue certificates to completed enrollments (all completed ones when the list is empty). */
export const sessionCertificatesBodySchema = z
  .object({
    enrollmentIds: z.array(z.string().trim().min(1).max(64)).max(5000).default([]),
    ...completionAcknowledgements,
  })
  .strict();
export type SessionCertificatesBody = z.infer<typeof sessionCertificatesBodySchema>;
