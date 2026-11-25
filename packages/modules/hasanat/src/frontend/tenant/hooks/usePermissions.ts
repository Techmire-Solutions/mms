import { useHasanatHost } from "../host.js";

export function usePermissions() {
  return useHasanatHost().usePermissions() as {
    can: (permission: string) => boolean;
    permissions?: readonly string[];
  };
}

export function useModulePermissions(manifest: unknown) {
  return useHasanatHost().useModulePermissions(manifest) as Record<string, boolean>;
}
