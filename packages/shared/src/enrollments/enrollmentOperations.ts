import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

/** Typed timeline events written by the server for mid-session operations. */
export const ENROLLMENT_EVENT_TYPES = ["placed", "transferred", "withdrawn"] as const;
export type EnrollmentEventType = (typeof ENROLLMENT_EVENT_TYPES)[number];

const reasonSchema = z.string().trim().min(3, "Give a reason").max(500);

/** Move an enrollment to another class/section of the same session from a date. */
export const enrollmentTransferBodySchema = z
  .object({
    classId: z.string().trim().min(1).max(64),
    sectionId: z.string().trim().min(1).max(64).nullable().optional(),
    effectiveOn: isoDateSchema,
    reason: reasonSchema,
  })
  .strict();
export type EnrollmentTransferBody = z.infer<typeof enrollmentTransferBodySchema>;

/** End an enrollment from a date (drop-out, transfer out); the seat is released. */
export const enrollmentWithdrawBodySchema = z
  .object({
    effectiveOn: isoDateSchema,
    reason: reasonSchema,
  })
  .strict();
export type EnrollmentWithdrawBody = z.infer<typeof enrollmentWithdrawBodySchema>;

/** One dated placement of an enrollment (class × section over [startOn, endOn]). */
export const enrollmentPlacementSchema = z
  .object({
    id: z.string(),
    enrollmentId: z.string(),
    classId: z.string(),
    sectionId: z.string().nullable(),
    startOn: z.string(),
    endOn: z.string().nullable(),
    reason: z.string().nullable(),
  })
  .strict();
export type EnrollmentPlacement = z.infer<typeof enrollmentPlacementSchema>;
