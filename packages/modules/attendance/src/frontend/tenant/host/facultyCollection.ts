import { getAttendanceHost } from "../host.js";

export function useFacultyCollection(...args: unknown[]): unknown[] {
  const fn = getAttendanceHost().facultyCollection?.useFacultyCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? result : [];
}

export function useFacultyContractList(
  ...args: unknown[]
): ReturnType<
  NonNullable<ReturnType<typeof getAttendanceHost>["facultyCollection"]["useFacultyContractList"]>
> {
  const fn = getAttendanceHost().facultyCollection?.useFacultyContractList;
  return typeof fn === "function" ? fn(...args) : { data: undefined, isLoading: false };
}
