import { getAttendanceHost } from "../host.js";

export function useAttendanceConfig(...args: any[]): any {
  return (getAttendanceHost() as any).useAttendanceConfig(...args);
}
