import { z } from "zod";
import { isoDateSchema, isoUtcTimestampSchema } from "../core/isoDateSchema.js";
import { moneyAmountSchema } from "../finance/accountingLedgerInvariants.js";
import { evaluateWorkshopDateRules } from "./workshopScheduleRules.js";
import {
  workshopCreateStatusSchema,
  workshopPhaseSchema,
  workshopStatusSchema,
} from "./workshopLifecycleSchemas.js";

export const WORKSHOP_PARTICIPANT_STATUSES = ["registered", "attended", "completed"] as const;
export const WORKSHOP_ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;

/** Upper bound on rows a single attendance or score save may carry. */
export const WORKSHOP_BULK_ROW_LIMIT = 500;

export type WorkshopParticipantStatus = (typeof WORKSHOP_PARTICIPANT_STATUSES)[number];
export type WorkshopAttendanceStatus = (typeof WORKSHOP_ATTENDANCE_STATUSES)[number];
export const workshopParticipantStatusSchema = z.enum(WORKSHOP_PARTICIPANT_STATUSES);
export const workshopAttendanceStatusSchema = z.enum(WORKSHOP_ATTENDANCE_STATUSES);

const softDeleteFields = {
  deletedAt: isoUtcTimestampSchema.nullable().optional(),
  deletedBy: z.string().nullable().optional(),
  deletionReason: z.string().nullable().optional(),
  restoredAt: isoUtcTimestampSchema.nullable().optional(),
  restoredBy: z.string().nullable().optional(),
};

/** A workshop as read back from the API (`participantCount` is derived). */
export const workshopEventRecordSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().default(""),
    startDate: isoDateSchema.nullable(),
    endDate: isoDateSchema.nullable(),
    registrationDeadline: isoDateSchema.nullable(),
    capacity: z.number().int().nullable(),
    fee: z.number().nullable(),
    programId: z.string().nullable(),
    subjectId: z.string().nullable(),
    minAttendancePct: z.number().nullable().default(null),
    minScorePct: z.number().nullable().default(null),
    participantCount: z.number().int().default(0),
    /** When full, a waitlist-enabled workshop queues registrations instead of refusing them. */
    waitlistEnabled: z.boolean().default(false),
    /** Persisted lifecycle intent; moves only through `POST /:id/transition`. */
    status: workshopStatusSchema,
    /** Derived product state (registration window / ongoing / finished / archived). */
    phase: workshopPhaseSchema,
    ...softDeleteFields,
    createdAt: isoUtcTimestampSchema.optional(),
    updatedAt: isoUtcTimestampSchema.optional(),
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
  minAttendancePct: z.number().min(0).max(100).nullable().optional(),
  minScorePct: z.number().min(0).max(100).nullable().optional(),
  waitlistEnabled: z.boolean().optional(),
};

type WorkshopDateFields = {
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
};

/**
 * End on or after start; the deadline cannot fall after the last day. Delegates to the shared
 * {@link evaluateWorkshopDateRules} so the contract and the write transaction enforce one rule.
 */
function checkWorkshopDates(value: WorkshopDateFields, ctx: z.RefinementCtx): void {
  for (const violation of evaluateWorkshopDateRules(value)) {
    if (violation === "end_before_start") {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "workshops.validation.endBeforeStart",
      });
    } else if (violation === "span_too_long") {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "workshops.validation.spanTooLong",
      });
    } else {
      ctx.addIssue({
        code: "custom",
        path: ["registrationDeadline"],
        message: "workshops.validation.deadlineAfterEnd",
      });
    }
  }
}

export const workshopEventCreateSchema = z
  .object({
    id: z.string().min(1).optional(),
    /** Omitted = `open` (the form publishes immediately); `draft` keeps it out of registration. */
    status: workshopCreateStatusSchema.optional(),
    ...workshopEventWriteFields,
  })
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
    status: workshopParticipantStatusSchema,
    completedAt: isoUtcTimestampSchema.nullable().default(null),
    certificateIssuedAt: isoUtcTimestampSchema.nullable().default(null),
    /** Set while the row is queued; null means the participant holds a seat. */
    waitlistedAt: isoUtcTimestampSchema.nullable().default(null),
    createdAt: isoUtcTimestampSchema.optional(),
  })
  .strict();

/** Mutation responses carry no contact phone; the roster/detail is where staff need it. */
export const workshopParticipantSummarySchema = workshopParticipantRecordSchema.omit({
  contactPhone: true,
});

export type WorkshopParticipantSummary = z.infer<typeof workshopParticipantSummarySchema>;

export function toWorkshopParticipantSummary(
  participant: WorkshopParticipant,
): WorkshopParticipantSummary {
  const { contactPhone: _contactPhone, ...summary } = participant;
  return summary;
}

export const workshopParticipantCreateSchema = z
  .object({ contactId: z.string().min(1, "workshops.validation.contactRequired") })
  .strict();

/** Bulk registration (import-ready): 1–100 contacts, applied atomically in input order. */
export const workshopParticipantsBulkCreateSchema = z
  .object({
    contactIds: z.array(z.string().trim().min(1)).min(1).max(100),
  })
  .strict();
export type WorkshopParticipantsBulkCreate = z.infer<typeof workshopParticipantsBulkCreateSchema>;

/** Queued participant import: up to 5,000 unique contacts (the worker chunks the work). */
export const workshopParticipantsImportSchema = z
  .object({
    contactIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(5_000)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Duplicate contact ids are not allowed in an import",
      }),
  })
  .strict();
export type WorkshopParticipantsImport = z.infer<typeof workshopParticipantsImportSchema>;

export const workshopAttendanceRecordSchema = z
  .object({
    participantId: z.string(),
    dayOn: isoDateSchema,
    status: workshopAttendanceStatusSchema,
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
            status: workshopAttendanceStatusSchema,
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
    /** Seated participants, ordered by contact name. */
    participants: z.array(workshopParticipantRecordSchema),
    /** Queued registrations, ordered by waitlist position (oldest first). */
    waitlisted: z.array(workshopParticipantRecordSchema),
    waitlistCount: z.number().int().default(0),
    attendance: z.array(workshopAttendanceRecordSchema),
    scores: z.array(workshopScoreRecordSchema),
  })
  .strict();

/** Envelope for paginated workshop list responses. */
export const workshopsPageResponseSchema = z
  .object({
    workshops: z.array(workshopEventRecordSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  })
  .strict();

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
