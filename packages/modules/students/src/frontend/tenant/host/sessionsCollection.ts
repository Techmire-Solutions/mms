import { getStudentsHost } from "../host.js";

export const SESSIONS_QUERY_KEY = ["sessions"] as const;

/** Lazily resolve host-provided sessions query key so module evaluation stays pure. */
export function getSessionsQueryKey(): readonly unknown[] {
  return (getStudentsHost() as any).sessionsCollection?.SESSIONS_QUERY_KEY ?? SESSIONS_QUERY_KEY;
}

export function useSessions(...args: any[]): any {
  return (getStudentsHost() as any).sessionsCollection?.useSessions?.(...args);
}

export function useSessionsCollection(..._args: any[]): any {
  return (getStudentsHost() as any).sessionsCollection;
}
