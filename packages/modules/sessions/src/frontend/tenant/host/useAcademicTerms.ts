import { getSessionsHost } from "../host.js";

export function useAcademicTerms(...args: any[]): any {
  return (getSessionsHost() as any).useAcademicTerms(...args);
}
