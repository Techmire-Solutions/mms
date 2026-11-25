import { useHasanatHost } from "../host.js";

export function useBranding(...args: any[]) {
  return useHasanatHost().useBranding(...args);
}
