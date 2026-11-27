import { getAnalyticsHost } from "../host.js";

export function useSavedReportsSource(...args: any[]): any {
  return (getAnalyticsHost() as any).useSavedReportsSource(...args);
}

export type SavedReportsSource<_A = any, _B = any> = any;

export function useGenericSavedReportsSource(...args: any[]): any {
  return (getAnalyticsHost() as any).useSavedReportsSource(...args);
}
