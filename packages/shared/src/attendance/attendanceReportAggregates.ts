import { z } from "zod";
import { monthKeySchema } from "../core/monthKeySchema.js";

export const attendanceReportComparisonSessionSchema = z.object({
  sessionId: z.string(),
  attendancePct: z.number().int().min(0).max(100),
});

export const attendanceReportComparisonMonthSchema = z.object({
  monthKey: monthKeySchema,
  presentCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const attendanceReportComparisonSchema = z.object({
  sessions: z.array(attendanceReportComparisonSessionSchema),
  monthly: z.object({
    a: z.array(attendanceReportComparisonMonthSchema),
    b: z.array(attendanceReportComparisonMonthSchema),
  }),
});

export const attendanceReportClassRateSchema = z.object({
  classId: z.string(),
  className: z.string(),
  sessionName: z.string(),
  presentCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  rate: z.number().int().min(0).max(100),
});

export const attendanceReportMonthlyTrendSchema = z.object({
  monthKey: monthKeySchema,
  presentCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  rate: z.number().int().min(0).max(100),
});

export const attendanceReportStudentRateSchema = z.object({
  studentId: z.string(),
  name: z.string(),
  presentCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  rate: z.number().int().min(0).max(100),
});

export const attendanceReportStatusCountSchema = z.object({
  status: z.string(),
  count: z.number().int().nonnegative(),
});

export const attendanceReportOverviewSchema = z.object({
  overallRate: z.number().int().min(0).max(100),
  totalRecords: z.number().int().nonnegative(),
  lowAttendanceCount: z.number().int().nonnegative(),
  classRates: z.array(attendanceReportClassRateSchema),
  monthlyTrend: z.array(attendanceReportMonthlyTrendSchema),
  studentRates: z.array(attendanceReportStudentRateSchema),
  topPerformers: z.array(attendanceReportStudentRateSchema),
  statusCounts: z.array(attendanceReportStatusCountSchema),
});

/** Attendance analytics plus an optional ComparisonMode slice. */
export const attendanceReportAggregatesSchema = z.object({
  overview: attendanceReportOverviewSchema,
  comparison: attendanceReportComparisonSchema.optional(),
});

export type AttendanceReportComparisonSession = z.infer<
  typeof attendanceReportComparisonSessionSchema
>;
export type AttendanceReportComparisonMonth = z.infer<typeof attendanceReportComparisonMonthSchema>;
export type AttendanceReportComparison = z.infer<typeof attendanceReportComparisonSchema>;
export type AttendanceReportOverview = z.infer<typeof attendanceReportOverviewSchema>;
export type AttendanceReportAggregates = z.infer<typeof attendanceReportAggregatesSchema>;

import {
  type BaseReportComparisonQuery,
  normalizeReportComparisonQuery,
  reportComparisonQueryActive,
} from "../reports/reportComparisonQuery.js";

/** Optional ComparisonMode params for GET /attendance/report-aggregates. */
export type AttendanceReportComparisonQuery = BaseReportComparisonQuery;

export type AttendanceReportAggregatesQuery = AttendanceReportComparisonQuery & {
  classId?: string;
};

export const attendanceReportAggregatesHttpQuerySchema = z.object({
  classId: z.string().max(100).optional(),
  sessionIds: z.string().max(200).optional(),
  rangeAFrom: z.string().max(32).optional(),
  rangeATo: z.string().max(32).optional(),
  rangeBFrom: z.string().max(32).optional(),
  rangeBTo: z.string().max(32).optional(),
});

export const EMPTY_ATTENDANCE_REPORT_COMPARISON: AttendanceReportComparison = {
  sessions: [],
  monthly: { a: [], b: [] },
};

export const EMPTY_ATTENDANCE_REPORT_OVERVIEW: AttendanceReportOverview = {
  overallRate: 0,
  totalRecords: 0,
  lowAttendanceCount: 0,
  classRates: [],
  monthlyTrend: [],
  studentRates: [],
  topPerformers: [],
  statusCounts: [],
};

export const EMPTY_ATTENDANCE_REPORT_AGGREGATES: AttendanceReportAggregates = {
  overview: EMPTY_ATTENDANCE_REPORT_OVERVIEW,
};

/**
 * Normalize ComparisonMode query params (max 2 sessionIds; ISO date ranges).
 */
export function normalizeAttendanceReportComparisonQuery(
  input: AttendanceReportComparisonQuery | undefined,
): AttendanceReportComparisonQuery | undefined {
  return normalizeReportComparisonQuery(input);
}

/** True when any comparison SQL slice should run. */
export function attendanceReportComparisonQueryActive(
  query: AttendanceReportComparisonQuery | undefined,
): boolean {
  return reportComparisonQueryActive(query);
}
