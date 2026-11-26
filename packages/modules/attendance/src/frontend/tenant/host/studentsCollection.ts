import { getAttendanceHost } from "../host.js";

export function useStudentsCollection(...args: unknown[]): unknown[] {
  const fn = getAttendanceHost().studentsCollection?.useStudentsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? result : [];
}

export function useStudentsContractList(...args: unknown[]) {
  const fn = getAttendanceHost().studentsCollection?.useStudentsContractList;
  return typeof fn === "function"
    ? fn(...args)
    : { data: { body: { students: [], hasMore: false } }, isFetching: false, isError: false };
}

export function useStudentsByIds(...args: unknown[]) {
  const fn = getAttendanceHost().studentsCollection?.useStudentsByIds;
  return typeof fn === "function" ? fn(...args) : { data: [], isLoading: false };
}
