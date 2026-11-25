import { getEnrollmentsHost } from "../host.js";

export function useAcademicTerms(...args: any[]): any {
  return (getEnrollmentsHost() as any).useAcademicTerms(...args);
}
