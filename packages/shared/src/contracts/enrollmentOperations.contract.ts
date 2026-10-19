import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { enrollmentRecordSchema } from "../enrollments/enrollmentsModuleManifest.js";
import {
  enrollmentPlacementSchema,
  enrollmentTransferBodySchema,
  enrollmentWithdrawBodySchema,
  withdrawalBillingOutcomeSchema,
} from "../enrollments/enrollmentOperations.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const enrollmentParams = z.object({ id: z.string().min(1).max(64) });
const operationResponses = {
  200: z.object({ enrollment: enrollmentRecordSchema }),
  400: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  500: errorResponse,
};

/** Mid-session enrollment operations: dated, audited, never overwriting history. */
export const enrollmentOperationsContract = c.router({
  placements: {
    method: "GET",
    path: "/api/enrollments/:id/placements",
    pathParams: enrollmentParams,
    responses: {
      200: z.object({ placements: z.array(enrollmentPlacementSchema) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Placement history (class × section over time) of an enrollment",
  },
  transfer: {
    method: "POST",
    path: "/api/enrollments/:id/transfer",
    pathParams: enrollmentParams,
    body: enrollmentTransferBodySchema,
    responses: operationResponses,
    summary: "Transfer an enrollment to another class/section from a date",
  },
  withdraw: {
    method: "POST",
    path: "/api/enrollments/:id/withdraw",
    pathParams: enrollmentParams,
    body: enrollmentWithdrawBodySchema,
    responses: {
      ...operationResponses,
      200: z.object({
        enrollment: enrollmentRecordSchema,
        billing: withdrawalBillingOutcomeSchema,
      }),
    },
    summary: "Withdraw an enrollment from a date and release its seat",
  },
});
