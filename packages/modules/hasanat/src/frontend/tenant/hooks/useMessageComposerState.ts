import { useHasanatHost } from "../host.js";

export function useMessageComposerState(...args: any[]) {
  return useHasanatHost().useMessageComposerState(...args);
}
