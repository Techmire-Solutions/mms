import { z } from "zod";

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
  })
  .strict();
export type SessionCompletionRow = z.infer<typeof sessionCompletionRowSchema>;

/** Issue certificates to completed enrollments (all completed ones when the list is empty). */
export const sessionCertificatesBodySchema = z
  .object({ enrollmentIds: z.array(z.string().trim().min(1).max(64)).max(5000).default([]) })
  .strict();
export type SessionCertificatesBody = z.infer<typeof sessionCertificatesBodySchema>;
