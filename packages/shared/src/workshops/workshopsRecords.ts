import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { moneyAmountSchema } from "../finance/accountingLedgerInvariants.js";

export const WORKSHOP_PARTICIPANT_STATUSES = ["registered", "attended", "completed"] as const;
export const WORKSHOP_ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;

/** Upper bound on rows a single attendance or score save may carry. */
export const WORKSHOP_BULK_ROW_LIMIT = 500;

export type WorkshopParticipantStatus = (typeof WORKSHOP_PARTICIPANT_STATUSES)[number];
export type WorkshopAttendanceStatus = (typeof WORKSHOP_ATTENDANCE_STATUSES)[number];

const softDeleteFields = {
  deletedAt: z.string().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
  deletionReason: z.string().nullable().optional(),
  restoredAt: z.string().nullable().optional(),
  restoredBy: z.string().nullable().optional(),
};

/** A workshop as read back from the API (`participantCount` is derived). */
export const workshopEventRecordSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().default(""),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    registrationDeadline: z.string().nullable(),
    capacity: z.number().int().nullable(),
    fee: z.number().nullable(),
    programId: z.string().nullable(),
    subjectId: z.string().nullable(),
    participantCount: z.number().int().default(0),
    ...softDeleteFields,
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

const workshopEventWriteFields = {
  title: z.string().trim().min(1, "workshops.validation.titleRequired").max(200),
  description: z.string().max(4000).optional().default(""),
  startDate: isoDateSchema.nullable().optional(),
  endDate: isoDateSchema.nullable().optional(),
  registrationDeadline: isoDateSchema.nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  fee: moneyAmountSchema.nullable().optional(),
  programId: z.string().min(1).nullable().optional(),
  subjectId: z.string().min(1).nullable().optional(),
};

type WorkshopDateFields = {
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
};

/** End on or after start; the deadline cannot fall after the last day. */
function checkWorkshopDates(value: WorkshopDateFields, ctx: z.RefinementCtx): void {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "workshops.validation.endBeforeStart",
    });
  }
  const lastDay = value.endDate ?? value.startDate;
  if (value.registrationDeadline && lastDay && value.registrationDeadline > lastDay) {
    ctx.addIssue({
      code: "custom",
      path: ["registrationDeadline"],
      message: "workshops.validation.deadlineAfterEnd",
    });
  }
}

export const workshopEventCreateSchema = z
  .object({ id: z.string().min(1).optional(), ...workshopEventWriteFields })
  .strict()
  .superRefine(checkWorkshopDates);

export const workshopEventUpdateSchema = z
  .object(workshopEventWriteFields)
  .partial()
  .strict()
  .superRefine(checkWorkshopDates);

export const workshopParticipantRecordSchema = z
  .object({
    id: z.string(),
    workshopId: z.string(),
    contactId: z.string(),
    contactName: z.string().default(""),
    contactPhone: z.string().default(""),
    status: z.enum(WORKSHOP_PARTICIPANT_STATUSES),
    createdAt: z.string().optional(),
  })
  .strict();

export const workshopParticipantCreateSchema = z
  .object({ contactId: z.string().min(1, "workshops.validation.contactRequired") })
  .strict();

export const workshopAttendanceRecordSchema = z
  .object({
    participantId: z.string(),
    dayOn: z.string(),
    status: z.enum(WORKSHOP_ATTENDANCE_STATUSES),
  })
  .strict();

/** One day of check-in for any subset of participants (upsert, never wipe). */
export const workshopAttendanceDayBodySchema = z
  .object({
    dayOn: isoDateSchema,
    marks: z
      .array(
        z
          .object({
            participantId: z.string().min(1),
            status: z.enum(WORKSHOP_ATTENDANCE_STATUSES),
          })
          .strict(),
      )
      .min(1)
      .max(WORKSHOP_BULK_ROW_LIMIT),
  })
  .strict();

const scoreFields = {
  participantId: z.string().min(1),
  criterionName: z.string().trim().min(1, "workshops.validation.criterionRequired").max(120),
  score: z.number().finite().nonnegative(),
  maxScore: z.number().finite().positive(),
  remarks: z.string().max(1000).nullable().optional(),
};

export const workshopScoreRecordSchema = z
  .object({ id: z.string(), ...scoreFields, remarks: z.string().nullable() })
  .strict();

/** Score lines keyed by (participant, criterion); saving the same key updates it. */
export const workshopScoresBodySchema = z
  .object({
    scores: z
      .array(
        z
          .object(scoreFields)
          .strict()
          .refine((line) => line.score <= line.maxScore, {
            path: ["score"],
            message: "workshops.validation.scoreAboveMax",
          }),
      )
      .min(1)
      .max(WORKSHOP_BULK_ROW_LIMIT),
  })
  .strict();

export const workshopDetailSchema = z
  .object({
    workshop: workshopEventRecordSchema,
    participants: z.array(workshopParticipantRecordSchema),
    attendance: z.array(workshopAttendanceRecordSchema),
    scores: z.array(workshopScoreRecordSchema),
  })
  .strict();

/** Envelope for paginated workshop list responses. */
export const workshopsPageResponseSchema = z.object({
  workshops: z.array(workshopEventRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export type WorkshopEvent = z.infer<typeof workshopEventRecordSchema>;
export type WorkshopEventCreate = z.infer<typeof workshopEventCreateSchema>;
export type WorkshopEventUpdate = z.infer<typeof workshopEventUpdateSchema>;
export type WorkshopParticipant = z.infer<typeof workshopParticipantRecordSchema>;
export type WorkshopAttendanceMark = z.infer<typeof workshopAttendanceRecordSchema>;
export type WorkshopAttendanceDayBody = z.infer<typeof workshopAttendanceDayBodySchema>;
export type WorkshopScore = z.infer<typeof workshopScoreRecordSchema>;
export type WorkshopScoresBody = z.infer<typeof workshopScoresBodySchema>;
export type WorkshopDetail = z.infer<typeof workshopDetailSchema>;
export type WorkshopsPageResponse = z.infer<typeof workshopsPageResponseSchema>;
