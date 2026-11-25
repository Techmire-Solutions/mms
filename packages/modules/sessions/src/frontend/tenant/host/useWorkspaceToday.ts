import { getSessionsHost } from "../host.js";

export function useWorkspaceToday(...args: any[]): any {
  return (getSessionsHost() as any).useWorkspaceToday(...args);
}
