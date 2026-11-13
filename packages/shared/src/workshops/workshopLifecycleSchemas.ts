import { z } from "zod";
import { isoUtcTimestampSchema } from "../core/isoDateSchema.js";
import {
  WORKSHOP_CREATE_STATUSES,
  WORKSHOP_LIFECYCLE_STATES,
  WORKSHOP_PHASES,
} from "./workshopLifecycle.js";

/**
 * Transport schemas for the workshop lifecycle rules in `workshopLifecycle.ts`.
 *
 * Split from the rule module so the pure state machine stays free of Zod and under the 300-line
 * band; the rules and their DTOs are still exported together from `@mms/shared`.
 */

export const workshopStatusSchema = z.enum(WORKSHOP_LIFECYCLE_STATES);
export const workshopPhaseSchema = z.enum(WORKSHOP_PHASES);
export const workshopCreateStatusSchema = z.enum(WORKSHOP_CREATE_STATUSES);

/** `PATCH`-style transition body: status changes only ever go through this action. */
export const workshopTransitionBodySchema = z
  .object({
    to: workshopStatusSchema,
    /** Required for `cancelled` (≥3 chars); ignored for other targets. */
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.to === "cancelled" && (value.reason ?? "").trim().length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "workshops.validation.cancelReasonRequired",
      });
    }
  });
export type WorkshopTransitionBody = z.infer<typeof workshopTransitionBodySchema>;

/** `x-expected-updated-at` is mandatory for lifecycle actions (428 without it). */
export const workshopOccHeadersSchema = z.object({
  "x-expected-updated-at": isoUtcTimestampSchema.optional(),
});
export type WorkshopOccHeaders = z.infer<typeof workshopOccHeadersSchema>;
