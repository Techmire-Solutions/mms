import { getObligationsHost } from "../host.js";

export function useBranding(...args: any[]): any {
  return (getObligationsHost() as any).useBranding(...args);
}
