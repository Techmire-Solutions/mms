import type { Session } from "@mms/contracts";
import { getStudentsHost } from "../host.js";

export const SESSIONS_QUERY_KEY = ["sessions"] as const;

/** Lazily resolve host-provided sessions query key so module evaluation stays pure. */
export function getSessionsQueryKey(): readonly unknown[] {
  const key = getStudentsHost().sessionsCollection?.SESSIONS_QUERY_KEY;
  return Array.isArray(key) ? key : SESSIONS_QUERY_KEY;
}

export function useSessions(...args: unknown[]) {
  const fn = getStudentsHost().sessionsCollection?.useSessions;
  return typeof fn === "function" ? fn(...args) : { data: undefined, isLoading: false };
}

export function useSessionsCollection(...args: unknown[]): Session[] {
  const fn = getStudentsHost().sessionsCollection?.useSessionsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? (result as Session[]) : [];
}
