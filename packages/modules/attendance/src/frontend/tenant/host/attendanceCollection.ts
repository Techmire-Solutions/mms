import { getAttendanceHost } from "../host.js";

export function useAttendanceCollection(..._args: any[]): any {
  return (getAttendanceHost() as any).attendanceCollection;
}

export function useAttendanceReportAggregates(...args: any[]): any {
  const v = (getAttendanceHost() as any).attendanceCollection?.["useAttendanceReportAggregates"];
  return typeof v === "function" ? v(...args) : v;
}
