import { getExaminationsHost } from "../host.js";

export function useEnrollmentsCollection(...args: any[]): any {
  return (getExaminationsHost() as any).useEnrollmentsCollection(...args);
}
