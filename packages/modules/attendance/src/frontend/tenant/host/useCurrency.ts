import { getAttendanceHost } from "../host.js";

export function useCurrency(...args: any[]): any {
  return (getAttendanceHost() as any).useCurrency(...args);
}

export function useFinanceCurrency(...args: any[]): any {
  return (getAttendanceHost() as any).useFinanceCurrency(...args);
}
