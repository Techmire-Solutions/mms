import type { Session } from "@mms/contracts";
import { useHasanatHost } from "../host.js";

/** App-bound sessions collection (cross-feature read used by recipient pickers). */
export function useSessionsCollection(options?: { enabled?: boolean }): Session[] {
  return useHasanatHost().useSessionsCollection(options) as Session[];
}
