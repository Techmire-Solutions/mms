import { getExaminationsHost } from "../host.js";

export function useBrandPalette(...args: any[]): any {
  return (getExaminationsHost() as any).useBrandPalette(...args);
}
