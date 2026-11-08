import { z } from "zod";

/**
 * Exam attendance-gate routes (migration 0222).
 *
 * The threshold is deliberately *not* part of the exam record DTO: exams CRUD is a generic bulk
 * surface, and adding a field there would ripple through every exam projection. These focused routes
 * own the gate, the audited overrides, and the results-finalisation stamp that completion needs.
 */

export const examEligibilityStudentSchema = z
  .object({
    studentId: z.string(),
    studentName: z.string(),
    classId: z.string(),
    state: z.enum(["eligible", "blocked", "unknown"]),
    attendancePct: z.number().nullable(),
    requiredPct: z.number().nullable(),
    overridden: z.boolean(),
  })
  .strict();

export const examEligibilityResponseSchema = z
  .object({
    examId: z.string(),
    requiredPct: z.number().nullable(),
    students: z.array(examEligibilityStudentSchema),
  })
  .strict();

export const examAttendanceGateBodySchema = z
  .object({ minAttendancePct: z.number().min(0).max(100).nullable() })
  .strict();

export const examEligibilityOverrideBodySchema = z
  .object({
    studentId: z.string().trim().min(1).max(64),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const examResultsFinalizationBodySchema = z.object({ finalized: z.boolean() }).strict();

export const examResultsFinalizationResponseSchema = z
  .object({
    examId: z.string(),
    resultsFinalizedAt: z.string().nullable(),
    status: z.string(),
  })
  .strict();

const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

export const examinationEligibilityRoutes = {
  getExamEligibility: {
    method: "GET",
    path: "/api/examinations/exams/:id/eligibility",
    responses: {
      200: examEligibilityResponseSchema,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Per-student attendance eligibility for an exam",
  },
  setExamAttendanceGate: {
    method: "PUT",
    path: "/api/examinations/exams/:id/attendance-gate",
    body: examAttendanceGateBodySchema,
    responses: {
      200: z.object({ examId: z.string(), minAttendancePct: z.number().nullable() }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Set (or clear) the minimum attendance required to sit an exam",
  },
  grantExamEligibilityOverride: {
    method: "POST",
    path: "/api/examinations/exams/:id/eligibility-overrides",
    body: examEligibilityOverrideBodySchema,
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Audited override allowing one student to sit the exam",
  },
  setExamResultsFinalized: {
    method: "POST",
    path: "/api/examinations/exams/:id/results-finalization",
    body: examResultsFinalizationBodySchema,
    responses: {
      200: examResultsFinalizationResponseSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Finalise (or re-open) exam results — completion only counts finalised exams",
  },
} as const;
