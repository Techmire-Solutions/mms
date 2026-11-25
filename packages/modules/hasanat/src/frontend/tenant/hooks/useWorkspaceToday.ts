import { useHasanatHost } from "../host.js";

/** Workspace-local ISO day (`YYYY-MM-DD`) from the app settings. */
export function useWorkspaceToday(): string {
  return useHasanatHost().useWorkspaceToday() as string;
}
