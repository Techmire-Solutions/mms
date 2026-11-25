import { useFacultyHost } from "../host.js";

export function useMessageComposerState(...args: any[]) {
  return useFacultyHost().useMessageComposerState(...args);
}
