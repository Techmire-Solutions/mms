import { getAttendanceHost } from "../host.js";

export function enrollmentData(...args: any[]): any {
  const v = (getAttendanceHost() as any).enrollmentData?.["enrollmentData"];
  return typeof v === "function" ? v(...args) : v;
}

export type Enrollment = any;
