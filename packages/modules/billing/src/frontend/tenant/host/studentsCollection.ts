import { useFinanceHostValue } from "../host.js";

export function useStudentsCollection(...args: unknown[]): unknown[] {
  const fn = useFinanceHostValue().studentsCollection?.useStudentsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? result : [];
}
