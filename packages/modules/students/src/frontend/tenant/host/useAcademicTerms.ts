import { getStudentsHost } from "../host.js";

export function useAcademicTerms(...args: any[]): any {
  return (getStudentsHost() as any).useAcademicTerms(...args);
}
