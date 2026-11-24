import { z } from "zod";

/**
 * Wire schema for `GET /api/attendance/metrics`.
 *
 * The route previously registered no response schema at all, so the payload was unvalidated and its
 * shape lived only in the repository. All values are integers (rates are rounded percentages).
 */
export const attendanceCommandMetricsSnapshotSchema = z
  .object({
    total: z.number().int().nonnegative(),
    selectedDatePresent: z.number().int().nonnegative(),
    selectedDateAbsent: z.number().int().nonnegative(),
    selectedDateLate: z.number().int().nonnegative(),
    selectedDateExcused: z.number().int().nonnegative(),
    periodTotal: z.number().int().nonnegative(),
    selectedDatePresentRate: z.number().int().nonnegative(),
    priorDatePresentRate: z.number().int().nonnegative(),
    overallPresentRate: z.number().int().nonnegative(),
  })
  .strict();

/** Envelope: the route returns `{ metrics }`. */
export const attendanceCommandMetricsResponseSchema = z
  .object({ metrics: attendanceCommandMetricsSnapshotSchema })
  .strict();
