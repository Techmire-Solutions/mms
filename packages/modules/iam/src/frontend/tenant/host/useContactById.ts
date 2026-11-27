import { getIamHost } from "../host.js";

export function useContactById(...args: any[]): any {
  return (getIamHost() as any).useContactById(...args);
}
