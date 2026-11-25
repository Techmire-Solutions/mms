import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).studentsCollection;

export function useStudentsCollection(..._args: any[]): any {
  return host();
}

export function useStudentsByIds(...args: any[]): any {
  const fn = host()?.useStudentsByIds;
  return typeof fn === "function" ? fn(...args) : { data: [], isLoading: false };
}

export function useStudentsContractList(...args: any[]): any {
  const fn = host()?.useStudentsContractList;
  return typeof fn === "function"
    ? fn(...args)
    : { data: { body: { students: [], hasMore: false } }, isFetching: false, isError: false };
}
