import { useFacultyHost } from "../host.js";

export function usePermissions(...args: any[]) {
  return useFacultyHost().usePermissions(...args);
}

export function useModulePermissions(...args: any[]) {
  return useFacultyHost().useModulePermissions(...args);
}
