import { getObligationsHost } from "../host.js";

export function useMessageComposerState(...args: any[]): any {
  return (getObligationsHost() as any).useMessageComposerState(...args);
}

export type UseMessageComposerStateResult = any;
