import { getSessionsHost } from "../host.js";

export function useMessageComposerState(...args: any[]): any {
  return (getSessionsHost() as any).useMessageComposerState(...args);
}
