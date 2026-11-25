import { getEnrollmentsHost } from "../host.js";

export function useViewerRole(...args: any[]): any {
  return (getEnrollmentsHost() as any).useViewerRole(...args);
}

export function useEnrollmentViewerRole(...args: any[]): any {
  return useViewerRole(...args);
}
