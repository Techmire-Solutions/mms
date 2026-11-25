import { getSessionsHost } from "../host.js";

export function useBranding(...args: any[]): any {
  return (getSessionsHost() as any).useBranding(...args);
}
