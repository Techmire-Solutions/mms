import { getIamHost } from "../host.js";

export function useWorkspaceToday(...args: any[]): any {
  return (getIamHost() as any).useWorkspaceToday(...args);
}
