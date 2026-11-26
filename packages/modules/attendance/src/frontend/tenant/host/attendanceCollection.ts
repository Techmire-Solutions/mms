import { getAttendanceHost } from "../host.js";

export function useAttendanceCollection(...args: unknown[]): unknown[] {
  const col = getAttendanceHost().attendanceCollection;
  const fn = col?.useAttendanceRecordsCollection ?? col?.useAttendanceCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? result : [];
}

export function useAttendanceReportAggregates(...args: unknown[]): unknown {
  const fn = getAttendanceHost().attendanceCollection?.useAttendanceReportAggregates;
  return typeof fn === "function" ? fn(...args) : fn;
}
