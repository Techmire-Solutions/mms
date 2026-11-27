import { getExaminationsHost } from "../host.js";

export function useBranding(...args: any[]): any {
  return (getExaminationsHost() as any).useBranding(...args);
}
