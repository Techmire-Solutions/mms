import { getEnrollmentsHost } from "../host.js";

export function useExaminationsCollection(..._args: any[]): any {
  return (getEnrollmentsHost() as any).examinationsCollection;
}

export const EXAMINATIONS_ELIGIBILITY_QUERY_KEY = ["examinations", "eligibility"] as const;
