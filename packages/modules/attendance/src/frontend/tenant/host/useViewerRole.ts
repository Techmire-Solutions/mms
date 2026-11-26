import { getAttendanceHost } from "../host.js";

export function useViewerRole(...args: any[]): any {
  return (getAttendanceHost() as any).useViewerRole(...args);
}
