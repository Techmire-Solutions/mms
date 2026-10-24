/**
 * Zero-valued attendance command metrics, returned when there is no tenant context.
 */
import { type AttendanceCommandMetricsSnapshot } from "@mms/shared";

export const EMPTY_ATTENDANCE_METRICS: AttendanceCommandMetricsSnapshot = {
  total: 0,
  selectedDatePresent: 0,
  selectedDateAbsent: 0,
  selectedDateLate: 0,
  selectedDateExcused: 0,
  periodTotal: 0,
  selectedDatePresentRate: 0,
  priorDatePresentRate: 0,
  overallPresentRate: 0,
};
