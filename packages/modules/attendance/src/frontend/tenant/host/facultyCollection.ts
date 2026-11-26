import { getAttendanceHost } from "../host.js";

export function useFacultyCollection(..._args: any[]): any {
  return (getAttendanceHost() as any).facultyCollection;
}

export function useFacultyContractList(...args: any[]): any {
  const v = (getAttendanceHost() as any).facultyCollection?.["useFacultyContractList"];
  return typeof v === "function" ? v(...args) : v;
}
