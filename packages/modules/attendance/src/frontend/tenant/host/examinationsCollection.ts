import type { Exam } from "@mms/contracts";
import { getAttendanceHost } from "../host.js";

export function useExaminationsCollection(...args: unknown[]): Exam[] {
  const col = getAttendanceHost().examinationsCollection;
  const fn = col?.useExaminationsExamsCollection ?? col?.useExaminationsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? (result as Exam[]) : [];
}

export const EXAMINATIONS_ELIGIBILITY_QUERY_KEY = ["examinations", "eligibility"] as const;
