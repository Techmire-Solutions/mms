import { useContactsHost } from "../host.js";

export function useModuleTierPageNav(...args: any[]) {
  return useContactsHost().useModuleTierPageNav(...args);
}
