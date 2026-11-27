import { getAnalyticsHost } from "../host.js";

export function useDashboardConfig(...args: any[]): any {
  return (getAnalyticsHost() as any).useDashboardConfig(...args);
}
