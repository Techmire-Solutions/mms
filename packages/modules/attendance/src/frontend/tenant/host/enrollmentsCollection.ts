import { getAttendanceHost } from "../host.js";

export function useEnrollmentsCollection(..._args: any[]): any {
  return (getAttendanceHost() as any).enrollmentsCollection;
}
