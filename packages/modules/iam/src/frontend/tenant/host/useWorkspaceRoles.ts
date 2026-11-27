import { getIamHost } from "../host.js";

export function useWorkspaceRoles(...args: any[]): any {
  return (getIamHost() as any).useWorkspaceRoles(...args);
}
