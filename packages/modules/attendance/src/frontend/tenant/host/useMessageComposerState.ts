import { getAttendanceHost } from "../host.js";

export function useMessageComposerState(...args: any[]): any {
  return (getAttendanceHost() as any).useMessageComposerState?.(...args) ?? {};
}
