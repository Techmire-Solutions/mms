import { getEnrollmentsHost } from "../host.js";

export function useEnrollmentConfig(...args: any[]): any {
  return (getEnrollmentsHost() as any).useEnrollmentConfig(...args);
}
