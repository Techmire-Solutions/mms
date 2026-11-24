import { z } from "zod";
import { attendanceRecordSchema } from "../attendance/attendanceModuleManifest.js";

/**
 * Response schemas for the attendance contract, extracted so the route table stays inside the
 * 300-line band (mms-structure-naming §3). Re-exported from `attendance.contract.ts`.
 */

/** Shared envelope for error responses (`errorResponse` in the contract). */
export const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

/** Normalized Attendance Setup preferences (`AttendanceModulePreferences`). */
export const attendancePreferencesResponseSchema = z.object({
  workingDays: z.array(z.string()),
  cutoffTime: z.string(),
  lateThresholdMins: z.number(),
  autoAbsentAfterMins: z.number(),
  qrEnabled: z.boolean(),
  lowAttendanceThreshold: z.number(),
  notifyParents: z.boolean(),
  requireNoteForAbsent: z.boolean(),
  lockAfterSubmit: z.boolean(),
  trackHalfDay: z.boolean(),
  weeklyReport: z.boolean(),
  attendanceAlerts: z.boolean(),
  allowManualOverride: z.boolean(),
  offlineEnabled: z.boolean(),
  geoTagging: z.boolean(),
  defaultViewLayout: z.string(),
});

/** Envelope for paginated attendance list responses (`AttendanceListPageResult`). */
export const attendanceListPageResponseSchema = z.object({
  records: z.array(attendanceRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
  /** Keyset cursor returned when `afterId` paging is used. */
  nextCursor: z.string().optional(),
});

/** Roster-day submission state (`lockAfterSubmit`). */
export const attendanceDaySubmissionResponseSchema = z.object({
  submission: z.object({
    classId: z.string(),
    date: z.string(),
    submittedAt: z.string(),
    submittedBy: z.string().nullable(),
    reopenedAt: z.string().nullable(),
    reopenedBy: z.string().nullable(),
    reopenReason: z.string().nullable(),
    locked: z.boolean(),
  }),
  alreadySubmitted: z.boolean(),
});
