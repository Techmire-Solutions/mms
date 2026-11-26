import { getAttendanceHost } from "../host.js";

export function studentsData(...args: any[]): any {
  const v = (getAttendanceHost() as any).studentsData?.["studentsData"];
  return typeof v === "function" ? v(...args) : v;
}

export type Student = any;
