import { getAnalyticsHost } from "../host.js";

export function useIsAdminViewer(...args: any[]): any {
  return (getAnalyticsHost() as any).useIsAdminViewer(...args);
}
