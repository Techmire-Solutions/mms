import { useFacultyHost } from "../host.js";

export function useWorkspaceToday(...args: any[]) {
  return useFacultyHost().useWorkspaceToday(...args);
}
