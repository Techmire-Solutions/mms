import { useFinanceHostValue } from "../host.js";

export function useStudentsCollection(..._args: any[]) {
  const c = (useFinanceHostValue() as any).studentsCollection;
  return c;
}
