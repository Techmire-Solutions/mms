import { useContactsHost } from "../host.js";

export function useMessageComposerState(...args: any[]) {
  return useContactsHost().useMessageComposerState(...args);
}
