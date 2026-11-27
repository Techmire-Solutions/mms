import { getIamHost } from "../host.js";

export function useGlobalSettings(...args: any[]): any {
  return (getIamHost() as any).useGlobalSettings(...args);
}
