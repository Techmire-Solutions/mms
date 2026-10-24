import { z } from "zod";
import { isoDateSchema as isoDate } from "../core/isoDateSchema.js";

/** Academic calendar exceptions (Attendance → Setup → Calendar). */
export const ACADEMIC_CALENDAR_EVENT_KINDS = [
  "holiday",
  "makeup_day",
  "exam_period",
  "event",
] as const;
export type AcademicCalendarEventKind = (typeof ACADEMIC_CALENDAR_EVENT_KINDS)[number];

/** Narrowest scope wins: section > class > session > workspace. */
export const ACADEMIC_CALENDAR_SCOPES = ["workspace", "session", "class", "section"] as const;
export type AcademicCalendarScope = (typeof ACADEMIC_CALENDAR_SCOPES)[number];

const optionalId = z
  .string()
  .trim()
  .max(64)
  .nullish()
  .transform((value) => (value ? value : null));

export const academicCalendarEventSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: z.enum(ACADEMIC_CALENDAR_EVENT_KINDS),
    startOn: isoDate,
    endOn: isoDate,
    scope: z.enum(ACADEMIC_CALENDAR_SCOPES),
    sessionId: z.string().nullable(),
    classId: z.string().nullable(),
    sectionId: z.string().nullable(),
    notes: z.string().nullable(),
    deletedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type AcademicCalendarEvent = z.infer<typeof academicCalendarEventSchema>;

/** Create/update body (PUT `/api/attendance/calendar/:id`). */
export const academicCalendarEventWriteSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(150),
    kind: z.enum(ACADEMIC_CALENDAR_EVENT_KINDS),
    startOn: isoDate,
    endOn: isoDate,
    scope: z.enum(ACADEMIC_CALENDAR_SCOPES).default("workspace"),
    sessionId: optionalId,
    classId: optionalId,
    sectionId: optionalId,
    notes: z
      .string()
      .trim()
      .max(1000)
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .strict()
  .refine((body) => body.endOn >= body.startOn, {
    path: ["endOn"],
    message: "End date must be on or after the start date",
  })
  .refine((body) => body.scope === "workspace" || Boolean(body.sessionId), {
    path: ["sessionId"],
    message: "Session is required",
  })
  .refine((body) => (body.scope !== "class" && body.scope !== "section") || Boolean(body.classId), {
    path: ["classId"],
    message: "Class is required",
  })
  .refine((body) => body.scope !== "section" || Boolean(body.sectionId), {
    path: ["sectionId"],
    message: "Section is required",
  });
export type AcademicCalendarEventWrite = z.input<typeof academicCalendarEventWriteSchema>;

export const academicCalendarListQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    includeDeleted: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  })
  .strict();
export type AcademicCalendarListQuery = z.infer<typeof academicCalendarListQuerySchema>;

/** Error type returned (409) when attendance is marked on a non-instructional day. */
export const NON_INSTRUCTIONAL_DAY_ERROR_TYPE = "non_instructional_day";
