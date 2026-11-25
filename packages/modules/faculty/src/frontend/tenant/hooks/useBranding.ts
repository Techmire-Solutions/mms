import { useFacultyHost } from "../host.js";

export function useBranding(...args: any[]) {
  return useFacultyHost().useBranding(...args);
}
