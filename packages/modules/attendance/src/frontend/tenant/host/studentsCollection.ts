import { getAttendanceHost } from "../host.js";

export function useStudentsCollection(..._args: any[]): any {
  return (getAttendanceHost() as any).studentsCollection;
}

export function useStudentsContractList(...args: any[]): any {
  const v = (getAttendanceHost() as any).studentsCollection?.["useStudentsContractList"];
  return typeof v === "function" ? v(...args) : v;
}

export function useStudentsByIds(...args: any[]): any {
  const v = (getAttendanceHost() as any).studentsCollection?.["useStudentsByIds"];
  return typeof v === "function" ? v(...args) : v;
}
