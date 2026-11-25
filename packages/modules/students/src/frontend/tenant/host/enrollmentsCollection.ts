import { getStudentsHost } from "../host.js";

export const ENROLLMENTS_QUERY_KEY = ["enrollments"] as const;

/** Lazily resolve host-provided enrollments query key so module evaluation stays pure. */
export function getEnrollmentsQueryKey(): readonly unknown[] {
  return (
    (getStudentsHost() as any).enrollmentsCollection?.ENROLLMENTS_QUERY_KEY ?? ENROLLMENTS_QUERY_KEY
  );
}

export function useEnrollmentsCollection(..._args: any[]): Record<string, (...args: any[]) => any> {
  return (getStudentsHost() as any).enrollmentsCollection;
}
