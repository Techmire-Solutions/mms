import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

/** Query for GET `/api/attendance/marked-dates`. */
export const attendanceMarkedDatesQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  classId: z.string().max(100).optional(),
  sectionId: z.string().max(100).optional(),
});
export type AttendanceMarkedDatesQuery = z.infer<typeof attendanceMarkedDatesQuerySchema>;

/** The distinct days that already carry at least one live attendance row. */
export const attendanceMarkedDatesSchema = z.object({
  dates: z.array(isoDateSchema),
});
export type AttendanceMarkedDates = z.infer<typeof attendanceMarkedDatesSchema>;

/**
 * Teaching days with no attendance marked against them.
 *
 * The gap is what staff chase: a day the calendar says was a teaching day, but which carries no
 * attendance row at all. A day with even one row counts as marked — partial rosters are a
 * different problem from a day nobody opened.
 *
 * @param instructionalDays - Teaching days in range (`listInstructionalDays` output)
 * @param markedDates - Days carrying at least one attendance row
 * @returns The unmarked teaching days, in ascending date order
 */
export function unmarkedInstructionalDays(
  instructionalDays: readonly string[],
  markedDates: readonly string[],
): string[] {
  const marked = new Set(markedDates);
  // `filter` already returns a fresh array, so sorting it in place leaves the caller's untouched.
  return instructionalDays.filter((day) => !marked.has(day)).sort();
}
