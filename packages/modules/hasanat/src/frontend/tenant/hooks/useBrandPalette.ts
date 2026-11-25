import { useHasanatHost } from "../host.js";

export function useBrandPalette(...args: any[]) {
  return useHasanatHost().useBrandPalette(...args);
}
