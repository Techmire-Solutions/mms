import { getEnrollmentsHost } from "../host.js";

const host = () => getEnrollmentsHost().studentsCollection;

export function useStudentsCollection(...args: unknown[]): unknown[] {
  const fn = host()?.useStudentsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? result : [];
}

export function useStudentsByIds(...args: unknown[]) {
  const fn = host()?.useStudentsByIds;
  return typeof fn === "function" ? fn(...args) : { data: [], isLoading: false };
}

export function useStudentsContractList(...args: unknown[]) {
  const fn = host()?.useStudentsContractList;
  return typeof fn === "function"
    ? fn(...args)
    : { data: { body: { students: [], hasMore: false } }, isFetching: false, isError: false };
}
