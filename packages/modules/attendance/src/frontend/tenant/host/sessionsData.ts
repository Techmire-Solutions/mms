import { getAttendanceHost } from "../host.js";

export function sessionsData(...args: any[]): any {
  const v = (getAttendanceHost() as any).sessionsData?.["sessionsData"];
  return typeof v === "function" ? v(...args) : v;
}

export type Session = any;
