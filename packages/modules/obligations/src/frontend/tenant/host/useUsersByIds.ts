import { getObligationsHost } from "../host.js";

export function useUsersByIds(...args: any[]): any {
  return (getObligationsHost() as any).useUsersByIds(...args);
}
