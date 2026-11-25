import { useFacultyHost } from "../host.js";

export function useSessions(...args: any[]) {
  return useFacultyHost().sessions.useSessions(...args);
}
export function useSessionsCollection(...args: any[]) {
  return useFacultyHost().sessions.useSessionsCollection(...args);
}
