import { getIamHost } from "../host.js";

export function useTenantProfile(...args: any[]): any {
  return (getIamHost() as any).useTenantProfile(...args);
}
