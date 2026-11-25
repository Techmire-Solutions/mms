import { useFacultyHost } from "../host.js";

export function useWorkspaceRoles(...args: any[]) {
  return useFacultyHost().useWorkspaceRoles(...args);
}
