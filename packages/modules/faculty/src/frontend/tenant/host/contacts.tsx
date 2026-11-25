import { useFacultyHost } from "../host.js";

export function useContactById(...args: any[]) {
  return useFacultyHost().contacts.useContactById(...args);
}
