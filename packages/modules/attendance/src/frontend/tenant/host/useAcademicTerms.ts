import { getAttendanceHost } from "../host.js";

export function useAcademicTerms(...args: any[]): any {
  return (getAttendanceHost() as any).useAcademicTerms(...args);
}
