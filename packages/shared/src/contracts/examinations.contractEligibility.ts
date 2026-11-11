import { z } from "zod";
import { MAX_GRACE_MARKS } from "../examinations/examinationsModuleManifest.js";
import { resourceIdParamsSchema } from "../schemas/api.dto.js";

/**
 * Exam attendance-gate routes (migration 0222).
 *
 * The threshold is deliberately *not* part of the exam record DTO: exams CRUD is a generic bulk
 * surface, and adding a field there would ripple through every exam projection. These focused routes
 * own the gate, the audited overrides, and the results-finalisation stamp that completion needs.
 */

/** Path params shared by the exam-scoped gate routes. */
export const examIdParamsSchema = resourceIdParamsSchema;

/** Path params for a gate/moderation route addressing one student's mark. */
export const examStudentParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    studentId: z.string().trim().min(1).max(64),
  })
  .strict();

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

export const examEligibilityRevokeBodySchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();

export const examResultsFinalizationBodySchema = z
  .object({
    finalized: z.boolean(),
    /**
     * Motivation for the change, required when re-opening published results: unpublishing is the
     * administrative unlock, and the reason is persisted on the audit event.
     */
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

/** Grace-mark adjustment on one mark. The raw `marks_obtained` is never rewritten. */
export const examResultModerationBodySchema = z
  .object({
    graceMarks: z.number().min(0).max(MAX_GRACE_MARKS),
    reason: z.string().trim().min(3).max(500),
    /** OCC token of the mark being moderated. */
    version: z.number().int().positive().optional(),
  })
  .strict();

export const examResultModerationResponseSchema = z
  .object({
    examId: z.string(),
    studentId: z.string(),
    marksObtained: z.number(),
    graceMarks: z.number(),
    effectiveMarks: z.number(),
    moderationReason: z.string().nullable(),
    moderatedAt: z.string().nullable(),
    version: z.number(),
  })
  .strict();

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
    pathParams: examIdParamsSchema,
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
    pathParams: examIdParamsSchema,
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
    pathParams: examIdParamsSchema,
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
  moderateExamResult: {
    method: "POST",
    path: "/api/examinations/exams/:id/results/:studentId/moderation",
    pathParams: examStudentParamsSchema,
    body: examResultModerationBodySchema,
    responses: {
      200: examResultModerationResponseSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Apply an audited grace-mark adjustment to one student's mark",
  },
  revokeExamEligibilityOverride: {
    method: "POST",
    path: "/api/examinations/exams/:id/eligibility-overrides/:studentId/revoke",
    pathParams: examStudentParamsSchema,
    body: examEligibilityRevokeBodySchema,
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Revoke an audited eligibility override (keeps the evidence)",
  },
  setExamResultsFinalized: {
    method: "POST",
    path: "/api/examinations/exams/:id/results-finalization",
    pathParams: examIdParamsSchema,
    body: examResultsFinalizationBodySchema,
    responses: {
      200: examResultsFinalizationResponseSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Finalise (or re-open) exam results — completion only counts finalised exams",
  },
} as const;
