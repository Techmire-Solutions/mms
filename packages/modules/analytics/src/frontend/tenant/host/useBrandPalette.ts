import { getAnalyticsHost } from "../host.js";

export function useBrandPalette(...args: any[]): any {
  return (getAnalyticsHost() as any).useBrandPalette(...args);
}
