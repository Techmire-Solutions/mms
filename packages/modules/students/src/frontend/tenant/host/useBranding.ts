import { getStudentsHost } from "../host.js";

export function useBranding(...args: any[]): any {
  return (getStudentsHost() as any).useBranding(...args);
}
