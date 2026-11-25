import { useMessagingHost } from "../host.js";

export function usePermissions(...args: any[]) {
  return useMessagingHost().usePermissions(...args);
}

export function useModulePermissions(...args: any[]) {
  return useMessagingHost().useModulePermissions(...args);
}
