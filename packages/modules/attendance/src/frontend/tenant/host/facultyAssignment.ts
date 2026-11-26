import { getAttendanceHost } from "../host.js";

export function facultyAssignment(...args: any[]): any {
  const v = (getAttendanceHost() as any).facultyAssignment?.["facultyAssignment"];
  return typeof v === "function" ? v(...args) : v;
}

export function activeFacultyForAssignment(...args: any[]): any {
  const v = (getAttendanceHost() as any).facultyAssignment?.["activeFacultyForAssignment"];
  return typeof v === "function" ? v(...args) : v;
}

export function resolveClassFacultyId(...args: any[]): any {
  const v = (getAttendanceHost() as any).facultyAssignment?.["resolveClassFacultyId"];
  return typeof v === "function" ? v(...args) : v;
}
