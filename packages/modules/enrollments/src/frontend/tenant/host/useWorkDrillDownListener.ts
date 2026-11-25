import { getEnrollmentsHost } from "../host.js";

export function useWorkDrillDownListener<_T = any>(...args: any[]): void {
  (getEnrollmentsHost() as any).useWorkDrillDownListener(...args);
}
