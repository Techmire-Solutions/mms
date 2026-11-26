import { getAttendanceHost } from "../host.js";

export function useSessionsCollection(..._args: any[]): any {
  return (getAttendanceHost() as any).sessionsCollection;
}
