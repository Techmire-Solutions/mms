import { getAttendanceHost } from "../host.js";

export function useWorkspaceToday(...args: any[]): any {
  return (getAttendanceHost() as any).useWorkspaceToday(...args);
}
