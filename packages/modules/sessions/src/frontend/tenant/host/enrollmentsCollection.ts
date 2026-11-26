import type { Enrollment } from "@mms/contracts";
import { getSessionsHost } from "../host.js";

export const enrollmentsCollection: Record<string, unknown> = new Proxy(
  {},
  {
    get: (_target, prop: string) => getSessionsHost().enrollmentsCollection?.[prop],
  },
);

export function useEnrollmentsCollection(...args: unknown[]): Enrollment[] {
  const fn = getSessionsHost().enrollmentsCollection?.useEnrollmentsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? (result as Enrollment[]) : [];
}

export function invalidateEnrollmentsQueries(...args: unknown[]): void {
  const fn = getSessionsHost().invalidation?.invalidateEnrollmentsQueries;
  if (typeof fn === "function") {
    fn(...args);
  }
}
