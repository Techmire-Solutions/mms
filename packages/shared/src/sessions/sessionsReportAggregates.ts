import { z } from "zod";
import { monthKeySchema } from "../core/monthKeySchema.js";

/** Per-class capacity row for Sessions Reports. */
export const sessionsReportCapacityItemSchema = z.object({
  sessionId: z.string(),
  classId: z.string(),
  session: z.string(),
  class: z.string(),
  enrolled: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative(),
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

export const sessionsReportAggregatesSchema = z.object({
  capacity: z.array(sessionsReportCapacityItemSchema),
  enrollmentTrends: z.array(sessionsReportEnrollmentTrendSchema),
  todaysSessions: z.array(sessionsReportTodaySessionSchema),
});

export type SessionsReportCapacityItem = z.infer<typeof sessionsReportCapacityItemSchema>;
export type SessionsReportEnrollmentTrend = z.infer<typeof sessionsReportEnrollmentTrendSchema>;
export type SessionsReportTodaySession = z.infer<typeof sessionsReportTodaySessionSchema>;
export type SessionsReportAggregates = z.infer<typeof sessionsReportAggregatesSchema>;
