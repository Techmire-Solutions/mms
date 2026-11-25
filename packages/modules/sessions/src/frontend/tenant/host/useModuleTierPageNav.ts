import { getSessionsHost } from "../host.js";

export function useModuleTierPageNav(...args: any[]): any {
  return (getSessionsHost() as any).useModuleTierPageNav(...args);
}
