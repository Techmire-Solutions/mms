import { useFacultyHost } from "../host.js";

export function useFacultyConfig(...args: any[]) {
  return useFacultyHost().useFacultyConfig(...args);
}
