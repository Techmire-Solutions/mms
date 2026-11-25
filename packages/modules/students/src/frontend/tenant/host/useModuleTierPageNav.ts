import { getStudentsHost } from "../host.js";

export function useModuleTierPageNav(...args: any[]): any {
  return (getStudentsHost() as any).useModuleTierPageNav(...args);
}
