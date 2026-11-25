import { getSessionsHost } from "../host.js";

export function useGlobalSettings(...args: any[]): any {
  return (getSessionsHost() as any).useGlobalSettings(...args);
}
