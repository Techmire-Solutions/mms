import { getAttendanceHost } from "../host.js";

export function useExaminationsCollection(..._args: any[]): any {
  return (getAttendanceHost() as any).examinationsCollection;
}

export const EXAMINATIONS_ELIGIBILITY_QUERY_KEY: any = (getAttendanceHost() as any)
  .examinationsCollection?.EXAMINATIONS_ELIGIBILITY_QUERY_KEY ?? ["examinations-eligibility"];
