import { getStudentsHost } from "../host.js";

export function useMessageComposerState(...args: any[]): any {
  return (getStudentsHost() as any).useMessageComposerState(...args);
}
