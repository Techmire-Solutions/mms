import type { Enrollment } from "@mms/contracts";
import { getAttendanceHost } from "../host.js";

export function useEnrollmentsCollection(...args: unknown[]): Enrollment[] {
  const fn = getAttendanceHost().enrollmentsCollection?.useEnrollmentsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? (result as Enrollment[]) : [];
}
