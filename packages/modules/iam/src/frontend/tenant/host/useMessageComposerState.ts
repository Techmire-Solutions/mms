import { getIamHost } from "../host.js";

export function useMessageComposerState(...args: any[]): any {
  return (getIamHost() as any).useMessageComposerState(...args);
}

export type MessagingTarget = any;
