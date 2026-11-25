import { getEnrollmentsHost } from "../host.js";

export function useMessageComposerState(...args: any[]): any {
  return (getEnrollmentsHost() as any).useMessageComposerState?.(...args) ?? {};
}
