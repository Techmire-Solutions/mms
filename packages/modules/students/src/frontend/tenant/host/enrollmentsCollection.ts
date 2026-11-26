import type { Enrollment } from "@mms/contracts";
import { getStudentsHost } from "../host.js";

export const ENROLLMENTS_QUERY_KEY = ["enrollments"] as const;

/** Lazily resolve host-provided enrollments query key so module evaluation stays pure. */
export function getEnrollmentsQueryKey(): readonly unknown[] {
  const key = getStudentsHost().enrollmentsCollection?.ENROLLMENTS_QUERY_KEY;
  return Array.isArray(key) ? key : ENROLLMENTS_QUERY_KEY;
}

export function useEnrollmentsCollection(...args: unknown[]): Enrollment[] {
  const fn = getStudentsHost().enrollmentsCollection?.useEnrollmentsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? (result as Enrollment[]) : [];
}
