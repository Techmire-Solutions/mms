import { useContactsHost } from "../host.js";

/** App-bound RBAC hook so relocated feature code keeps calling `usePermissions()`. */
export function usePermissions() {
  return useContactsHost().usePermissions();
}

export function useModulePermissions(manifest: any) {
  return useContactsHost().useModulePermissions(manifest);
}
