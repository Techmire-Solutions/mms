import { getSessionsHost } from "../host.js";

function inv(name: string) {
  return (...args: any[]) => (getSessionsHost() as any).invalidation?.[name]?.(...args);
}

export const invalidateEnrollmentsQueries: any = inv("invalidateEnrollmentsQueries");
export const invalidateSessionsQueries: any = inv("invalidateSessionsQueries");
export const invalidateStudentsQueries: any = inv("invalidateStudentsQueries");
export const invalidateFinanceQueries: any = inv("invalidateFinanceQueries");
export const ENROLLMENT_PLACEMENTS_QUERY_KEY = ["enrollments", "placements"] as const;
export function getEnrollmentPlacementsQueryKey(): readonly unknown[] {
  return (
    (getSessionsHost() as any).invalidation?.ENROLLMENT_PLACEMENTS_QUERY_KEY ??
    ENROLLMENT_PLACEMENTS_QUERY_KEY
  );
}
