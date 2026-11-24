import { z } from "zod";
import { monthKeySchema } from "../core/monthKeySchema.js";
import { isoDateSchema } from "../core/isoDateSchema.js";

/** Per-class capacity row for Sessions Reports. */
export const sessionsReportCapacityItemSchema = z.object({
  sessionId: z.string(),
  classId: z.string(),
  session: z.string(),
  class: z.string(),
  enrolled: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative(),
  /** Seats still available (capacity − enrolled), clamped at zero. */
  freeSeats: z.number().int().nonnegative().optional(),
  rate: z.number().int().nonnegative(),
  status: z.string(),
});

/** Enrollment trend bucket — `monthKey` is YYYY-MM; FE localizes display labels. */
export const sessionsReportEnrollmentTrendSchema = z.object({
  monthKey: monthKeySchema,
  students: z.number().int().nonnegative(),
  sessionName: z.string().nullable(),
});

/** Today's timetable/class rows for Sessions Reports embedded widget. */
export const sessionsReportTodaySessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  teacher: z.string(),
  time: z.string(),
  room: z.string(),
  students: z.number().int().nonnegative(),
  status: z.enum(["live", "upcoming"]),
});

/** Completion outcomes for one session (only final `completed`/`not_completed` count). */
export const sessionsReportCompletionItemSchema = z.object({
  sessionId: z.string(),
  session: z.string(),
  completed: z.number().int().nonnegative(),
  notCompleted: z.number().int().nonnegative(),
  rate: z.number().int().nonnegative(),
});
export type SessionsReportCompletionItem = z.infer<typeof sessionsReportCompletionItemSchema>;

/** Optional filters for report aggregates; trends default to the last 12 months. */
export const sessionsReportQuerySchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    includeCompleted: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  })
  .strict();
export type SessionsReportQuery = z.infer<typeof sessionsReportQuerySchema>;

/** Query for `GET /api/sessions/:id/timetable.ics|.csv`; dates default to the session range. */
export const sessionsTimetableExportQuerySchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    classId: z.string().trim().max(64).optional(),
  })
  .strict();
export type SessionsTimetableExportQuery = z.infer<typeof sessionsTimetableExportQuerySchema>;

export const sessionsReportAggregatesSchema = z.object({
  capacity: z.array(sessionsReportCapacityItemSchema),
  enrollmentTrends: z.array(sessionsReportEnrollmentTrendSchema),
  todaysSessions: z.array(sessionsReportTodaySessionSchema),
  /** Additive: omitted by older callers/fakes, always populated by the SQL adapter. */
  completion: z.array(sessionsReportCompletionItemSchema).optional(),
});

export type SessionsReportCapacityItem = z.infer<typeof sessionsReportCapacityItemSchema>;
export type SessionsReportTodaySession = z.infer<typeof sessionsReportTodaySessionSchema>;
export type SessionsReportAggregates = z.infer<typeof sessionsReportAggregatesSchema>;
