import { getObligationsHost } from "../host.js";

export function useBrandPalette(...args: any[]): any {
  return (getObligationsHost() as any).useBrandPalette(...args);
}
