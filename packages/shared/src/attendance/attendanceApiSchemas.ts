import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { ATTENDANCE_LOOKUP_KINDS } from "./attendanceLookupTypes.js";

/**
 * Path, query and error schemas shared by every attendance route.
 *
 * The brief requires strict, bounded request schemas on **every** route: nine routes previously
 * carried `:id` / `:classId/:date` / `:kind` segments with no `pathParams` at all, and the list query
 * was a passthrough, so unknown keys and over-long ids reached the handlers.
 */

/** Attendance row ids and student ids are text keys bounded by the schema columns. */
export const attendanceIdSchema = z.string().trim().min(1).max(64);
export const attendanceClassIdSchema = z.string().trim().min(1).max(64);
export const attendanceKindSchema = z.enum(ATTENDANCE_LOOKUP_KINDS);

/** `:id` route params. */
export const attendanceIdPathParamsSchema = z.object({ id: attendanceIdSchema }).strict();

/** `days/:classId/:date` route params — a malformed day never reaches the use case. */
export const attendanceDayPathParamsSchema = z
  .object({ classId: attendanceClassIdSchema, date: isoDateSchema })
  .strict();

/** `lookups/:kind` route params, constrained to the supported kinds. */
export const attendanceKindPathParamsSchema = z.object({ kind: attendanceKindSchema }).strict();

/**
 * Interactive list query — strict on purpose.
 *
 * `sortField` is an enum because the builder used to silently fall back to `updated_at` for any
 * unknown value, and `sectionId` is part of the matrix filters (it existed in the UI with no server
 * field). Date fields are validated as calendar days and cross-checked.
 */
export const ATTENDANCE_LIST_SORT_FIELDS = [
  "date",
  "studentName",
  "rollNo",
  "status",
  "updatedAt",
] as const;

export const attendanceListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().max(500).optional(),
    sessionId: z.string().trim().max(100).optional(),
    classId: z.string().trim().max(100).optional(),
    sectionId: z.string().trim().max(100).optional(),
    facultyId: z.string().trim().max(100).optional(),
    date: isoDateSchema.optional(),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    status: z.string().max(200).optional(),
    sortField: z.enum(ATTENDANCE_LIST_SORT_FIELDS).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    includeDeleted: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
    afterId: z.string().trim().max(64).optional(),
    skipCount: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  })
  .strict()
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: "dateFrom must not be after dateTo",
    path: ["dateTo"],
  });

/**
 * Marking-matrix query.
 *
 * A roster is a different resource from the interactive list: it must return **every** mark for one
 * class/day (the grid cannot page), so it has its own bound instead of the list's 100.
 */
export const ATTENDANCE_ROSTER_MAX_RECORDS = 1000;

export const attendanceRosterQuerySchema = z
  .object({
    classId: attendanceClassIdSchema,
    date: isoDateSchema,
    sectionId: z.string().trim().max(100).optional(),
  })
  .strict();

/** One failed row inside a rejected batch. */
export const attendanceBatchRowErrorSchema = z
  .object({
    /** Zero-based position in the submitted `records` array. */
    index: z.number().int().min(0),
    studentId: z.string(),
    date: z.string(),
    code: z.string(),
    message: z.string(),
  })
  .strict();

/**
 * Rejection envelope for batch writes.
 *
 * The batch stays atomic (nothing is written), but every failing row is reported instead of only the
 * first one — the previous behaviour flattened a 3-bad-row roster into one message.
 */
export const attendanceBatchRejectionSchema = z
  .object({
    type: z.literal("attendance_batch_rejected"),
    message: z.string(),
    /** Human-readable codes, also surfaced by `handleContractError`. */
    violations: z.array(z.string()).optional(),
    errors: z.array(attendanceBatchRowErrorSchema).max(50).optional(),
  })
  .passthrough();

/**
 * Justification header for a write that overrides a lock or the marking cut-off.
 *
 * Required only when the write would otherwise be refused, so ordinary marking stays header-free.
 * The bulk route additionally accepts `overrideReason` in its body (one reason for the batch).
 */
export const attendanceReasonHeaderSchema = z
  .object({ "x-attendance-reason": z.string().trim().min(3).max(500).optional() })
  .passthrough();

/** Late-upload window for device check-ins (a device may queue while offline). */
export const ATTENDANCE_CHECKIN_LATE_WINDOW_DAYS = 7;
/** Batch ceiling for one device check-in post. */
export const ATTENDANCE_CHECKIN_MAX_ROWS = 2000;

export const attendanceCheckInRowSchema = z
  .object({
    studentId: z.string().trim().min(1).max(64),
    classId: z.string().trim().min(1).max(64),
    /** Optional for a full ISO timestamp; otherwise required alongside `timeIn`. */
    date: isoDateSchema.optional(),
    /** `HH:mm`, `HH:mm:ss`, ISO-8601 with offset, or epoch milliseconds (as a string). */
    timeIn: z.string().trim().min(1).max(40),
    externalId: z.string().trim().max(120).optional(),
  })
  .strict();

export const attendanceCheckInBodySchema = z
  .object({
    deviceId: z.string().trim().max(64).optional(),
    rows: z.array(attendanceCheckInRowSchema).min(1).max(ATTENDANCE_CHECKIN_MAX_ROWS),
  })
  .strict();

export type AttendanceCheckInRow = z.infer<typeof attendanceCheckInRowSchema>;
export type AttendanceCheckInBody = z.infer<typeof attendanceCheckInBodySchema>;

export const attendanceCheckInRejectionSchema = z
  .object({
    row: z.number().int().min(0),
    code: z.string(),
    message: z.string(),
  })
  .strict();

/** Optional tenant attachment reference for an excuse (medical certificate). */
export const attendanceAttachmentUrlSchema = z
  .string()
  .trim()
  .max(300)
  .regex(
    /^\/uploads\/tenants\/[^/]+\/attachments\/[^/]+$/,
    "Attachments must reference this workspace's attachment storage",
  );

export type AttendanceListSortField = (typeof ATTENDANCE_LIST_SORT_FIELDS)[number];
export type AttendanceBatchRowError = z.infer<typeof attendanceBatchRowErrorSchema>;
