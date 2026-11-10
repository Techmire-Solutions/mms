import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import {
  hasanatBatchAwardBodySchema,
  hasanatBatchAwardResultSchema,
  hasanatBatchRecipientsResponseSchema,
} from "../hasanat/hasanatBatchAward.js";
import {
  hasanatStudentReportResponseSchema,
  hasanatStudentSummarySchema,
} from "../hasanat/hasanatTierContract.js";

const ok = z.unknown();

/**
 * Tier/batch/report contract entries, spread into the main hasanat router.
 * Split out to keep `hasanat.contract.ts` inside the 300-line ceiling.
 */
export const hasanatTierBatchContractRoutes = {
  batchAward: {
    method: "POST",
    path: "/api/hasanat/distributions/batch",
    body: hasanatBatchAwardBodySchema,
    responses: {
      200: hasanatBatchAwardResultSchema,
      202: hasanatBatchAwardResultSchema,
      403: ok,
      409: ok,
      500: ok,
    },
    summary: "Award one Hasanat card to every recipient of a class section or student group",
  },
  batchRecipients: {
    method: "GET",
    path: "/api/hasanat/distributions/batch/recipients",
    query: z
      .object({
        sessionId: z.string().trim().min(1).max(64).optional(),
        classId: z.string().trim().min(1).max(64).optional(),
        sectionId: z.string().trim().min(1).max(64).optional(),
        /** Comma-separated student ids, capped at the batch maximum (1000 × 65 chars). */
        studentIds: z.string().max(65_000).optional(),
      })
      .strict()
      .refine(
        (value) => Boolean(value.studentIds?.trim()) || Boolean(value.sessionId && value.classId),
        { message: "Provide studentIds, or both sessionId and classId" },
      )
      .optional(),
    responses: { 200: hasanatBatchRecipientsResponseSchema, 400: ok, 403: ok, 500: ok },
    summary: "Preview the recipients of a batch award",
  },
  studentSummary: {
    method: "GET",
    path: "/api/hasanat/students/:id/summary",
    pathParams: z.object({ id: z.string().trim().min(1).max(64) }),
    query: z
      .object({ sessionId: z.string().trim().min(1).max(64).optional() })
      .strict()
      .optional(),
    responses: { 200: hasanatStudentSummarySchema, 403: ok, 404: ok, 500: ok },
    summary: "Student progression: earned/balance, tier and award history",
  },
  studentReport: {
    method: "GET",
    path: "/api/hasanat/reports/students",
    query: z
      .object({
        sessionId: z.string().trim().min(1).max(64).optional(),
        classId: z.string().trim().min(1).max(64).optional(),
        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
      })
      .strict()
      .optional(),
    responses: { 200: hasanatStudentReportResponseSchema, 403: ok, 500: ok },
    summary: "Per-student Hasanat report (earned/balance/redeemed + derived tier)",
  },
  reconcileTiers: {
    method: "POST",
    path: "/api/hasanat/tiers/reconcile",
    body: z.object({}).optional(),
    responses: {
      200: z.object({
        students: z.number(),
        awarded: z.number(),
        revoked: z.number(),
      }),
      403: ok,
      500: ok,
    },
    summary: "Reconcile tier awards for the workspace (backfill)",
  },
} as const;
