import { getExaminationsHost } from "../host.js";

export function useAcademicTerms(...args: any[]): any {
  return (getExaminationsHost() as any).useAcademicTerms(...args);
}
